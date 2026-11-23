// src/modules/iaLocal/adaptador.ts
//
// Traduce la forma intermedia de la IA (ver esquema.ts) a la forma
// REAL que ya usa el resto de DEC (FormularioCircuito/DatosTablero) y
// corre la MISMA validación que el formulario manual — para que un
// circuito importado por IA sea indistinguible de uno tipeado a mano
// (mismo criterio ya establecido para "Importación de equipos por
// texto", ver ImportarEquiposTexto.jsx).
//
// Importa ApplicationMediator (a diferencia de esquema.ts/ollamaClient.ts,
// que son puros) porque necesita la normativa activa para rellenar un
// voltaje por defecto cuando el documento no lo dio — igual que ya
// hace el formulario de tablero (tensionPorDefecto en PanelTableros.jsx).

import { ApplicationMediator as App } from "../../core/ApplicationMediator.js";
import type { TableroExtraido } from "./esquema.ts";
import type { FormularioCircuito, FormularioEquipo } from "../validacion/formularios.ts";
import type { DatosTablero } from "../tablero/tipos.ts";

const { CIRCUITO_VACIO, EQUIPO_VACIO, TABLERO_VACIO } = App.data.tablas.plantillas();

export interface CircuitoParaImportar {
  descripcion: string;
  form: FormularioCircuito;
  // Equipo "resumen" que representa la carga declarada en el documento
  // — null si el documento no dio ni potencia ni corriente para este
  // circuito, en cuyo caso el circuito se crea sin carga y el usuario
  // la completa a mano (mismo criterio de "nunca inventar un dato que
  // no esté" que el resto de la importación).
  equipoForm: FormularioEquipo | null;
  // Amperaje del breaker/PIA tal como lo da el documento, SOLO para
  // mostrarlo de referencia en la vista previa — usuario, 2026-11-23:
  // confundir esto con la carga real infla el total ("todo prendido a
  // la vez" con el margen del breaker incluido). Nunca se usa para
  // calcular nada, el breaker real lo deriva DEC de la carga.
  breakerDocumentoA: number | null;
  advertencias: string[];
  valido: boolean;
  errorValidacion: string | null;
  incluir: boolean;
}

export interface TableroParaImportar {
  nombre: string;
  datos: DatosTablero;
  circuitos: CircuitoParaImportar[];
}

function primerVoltajeEstandar(normativaActiva: string, fases: string): number | null {
  const lista = App.normativa.voltajesPorFase(normativaActiva, fases);
  return lista?.[0] ?? null;
}

export function adaptarParaImportar(tableros: TableroExtraido[], normativaActiva: string): TableroParaImportar[] {
  return tableros.map((t) => {
    const fasesTablero = t.fases || "mono";
    const tensionTablero = t.tension_v ?? primerVoltajeEstandar(normativaActiva, fasesTablero) ?? 120;

    const datosTablero = {
      ...TABLERO_VACIO,
      nombre: t.nombre,
      tensionAlimentacion: String(tensionTablero),
      fases: fasesTablero,
      longitudAlimentador: t.longitud_alimentador_m != null ? String(t.longitud_alimentador_m) : "",
    };

    const circuitos: CircuitoParaImportar[] = t.circuitos.map((c) => {
      const advertencias: string[] = [];
      const fases = c.fases || fasesTablero;

      let voltaje = c.voltaje_v;
      if (voltaje == null) {
        voltaje = t.tension_v ?? primerVoltajeEstandar(normativaActiva, fases) ?? 120;
        advertencias.push(`Sin voltaje en el documento — se usó ${voltaje}V por defecto, revisar.`);
      }

      const form = {
        ...CIRCUITO_VACIO,
        nombre: c.descripcion,
        funcion: c.descripcion,
        fases,
        voltaje: String(voltaje),
        voltajeManual: true,
        distancia: "0",
        temp: "30",
      };

      // La carga real del documento se traduce en un equipo "resumen"
      // adentro del circuito (CIRCUITO_VACIO no tiene un campo de carga
      // propio — la carga real vive en sus equipos, igual que en el
      // formulario manual). Se PREFIERE la potencia real (potencia_w)
      // sobre la corriente del breaker — usuario, 2026-11-23: usar el
      // amperaje del breaker como si fuera la carga infla el total
      // (el breaker siempre tiene margen de seguridad sobre la carga
      // real). La corriente del breaker solo se usa como ÚLTIMO
      // recurso, cuando el documento no da potencia — y queda avisado
      // como una aproximación, no un dato exacto.
      let equipoForm: FormularioEquipo | null = null;
      if (c.potencia_w != null) {
        equipoForm = {
          ...EQUIPO_VACIO,
          nombre: c.descripcion || "Carga según documento",
          funcion: "Importado de memoria técnica (IA local)",
          cantidad: "1",
          modoEntrada: "potencia",
          valor: String(c.potencia_w),
        };
      } else if (c.corriente_a != null) {
        equipoForm = {
          ...EQUIPO_VACIO,
          nombre: c.descripcion || "Carga según documento",
          funcion: "Importado de memoria técnica (IA local)",
          cantidad: "1",
          modoEntrada: "corriente",
          valor: String(c.corriente_a),
        };
        advertencias.push(
          `El documento no da la potencia real de este circuito — se usó el amperaje del breaker (${c.corriente_a}A) como aproximación, probablemente sobreestima la carga real.`
        );
      } else {
        advertencias.push("Sin potencia ni corriente en el documento — el circuito se crea sin carga, hay que agregarla a mano.");
      }

      const errorValidacion = App.validacion.validarFormularioCircuito(form);
      const errorEquipo = equipoForm ? App.validacion.validarFormularioEquipo(equipoForm) : null;
      if (errorEquipo) advertencias.push(`La carga extraída no es válida (${errorEquipo}) — revisar a mano.`);

      return {
        descripcion: c.descripcion,
        form,
        equipoForm: errorEquipo ? null : equipoForm,
        breakerDocumentoA: c.corriente_a,
        advertencias,
        valido: !errorValidacion,
        errorValidacion,
        incluir: !errorValidacion,
      };
    });

    return { nombre: t.nombre, datos: datosTablero, circuitos };
  });
}
