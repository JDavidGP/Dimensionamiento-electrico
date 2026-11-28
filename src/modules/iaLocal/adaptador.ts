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

import { ApplicationMediator as App } from "../../core/ApplicationMediator.ts";
import type { TableroExtraido } from "./esquema.ts";
import type { FormularioCircuito, FormularioEquipo } from "../validacion/formularios.ts";
import type { FormularioTablero } from "../../shared/data/plantillas.ts";
import type { Fases } from "../normativa/tipos.ts";

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
  // Forma de FORMULARIO (todo texto), no el Tablero real parseado — ver
  // FormularioTablero (shared/data/plantillas.ts). Hoy solo se MUESTRA
  // en la vista previa (ImportarProyectoPDF.jsx); crear el tablero real
  // a partir de esto queda pendiente (igual que circuitoForm/equipoForm
  // sí tienen su paso de creación real, esto todavía no).
  datos: FormularioTablero;
  circuitos: CircuitoParaImportar[];
}

function primerVoltajeEstandar(normativaActiva: string, fases: Fases): number | null {
  const lista = App.normativa.voltajesPorFase(normativaActiva, fases);
  return lista?.[0] ?? null;
}

// Plausibilidad breaker↔carga (usuario, 2026-11-25, tras probar con una
// memoria técnica real de 8 páginas con contenido duplicado: la IA
// local devolvió el MISMO amperaje — el de la acometida completa,
// "Iprot = 113.9A" — como si fuera el breaker de CADA circuito, desde
// una luz de 480W hasta una ducha de 4500W. esquema.ts solo valida que
// corriente_a esté en un rango físico posible EN SÍ MISMO (0.01–10000A)
// — 113.9A pasa ese filtro sin problema, pero es absurdo para una
// lámpara. Acá se cruza contra la carga real (potencia_w/voltaje_v) de
// ESE circuito — nunca se corrige el valor (podría ser el dato real),
// solo se avisa cuando no calza ni de lejos, para que el usuario lo
// revise contra el documento antes de confiar en la vista previa.
const FACTOR_BREAKER_MAXIMO_RAZONABLE = 8; // generoso: cubre hasta motores con alto margen de arranque (NEC 430) sin disparar falsos positivos en casos normales
function corrienteCargaAproximadaA(potenciaW: number, voltajeV: number, fases: string): number | null {
  if (!(potenciaW > 0) || !(voltajeV > 0)) return null;
  const divisor = fases === "tri" ? voltajeV * Math.sqrt(3) : voltajeV;
  return potenciaW / divisor;
}

// Nombres de dispositivos del CUADRO (no circuitos) — usuario,
// 2026-11-28, segunda vuelta con la misma memoria REBT real: a pesar de
// la regla nueva en ollamaClient.ts, el modelo (3B, corriendo local)
// volvió a confundirlos con circuitos, esta vez con un agravante — les
// asignó la corriente NOMINAL DEL DISPOSITIVO (25A del ICP, 25A del
// IGA, 40A del diferencial) como si fuera corriente_a de un circuito
// real. adaptador.ts YA trataba corriente_a como aproximación de carga
// cuando falta potencia_w (caso legítimo: un circuito real sin potencia
// declarada, usando el amperaje de SU PROPIO breaker) — acá NO aplica,
// ese amperaje es del dispositivo en sí, no de ninguna carga, y usarlo
// así fabrica una demanda irreal (en este caso 20700W/90A de la nada).
// Reconocidos por nombre (español/inglés, con o sin la sigla entre
// paréntesis) — la propia lista de ollamaClient.ts enumera estos mismos
// dispositivos, así que el patrón cubre exactamente lo que se le pidió
// NO incluir.
const PATRONES_DISPOSITIVO_CUADRO: RegExp[] = [
  /\bICP\b/i,
  /\bIGA\b/i,
  /\bDPS\b/i,
  /\bSPD\b/i,
  /\bPIA\b/i,
  /\bGFCI\b/i,
  /interruptor de control de potencia/i,
  /interruptor general autom/i,
  /\binterruptor general\b/i,
  /\bmain breaker\b/i,
  /protecci[oó]n contra sobretensiones/i,
  /protector(?:es)? de sobretensiones/i,
  /interruptor diferencial/i,
];
function pareceDispositivoDelCuadro(descripcion: string): boolean {
  return PATRONES_DISPOSITIVO_CUADRO.some((patron) => patron.test(descripcion));
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
      // Sin NINGÚN dato numérico (ni voltaje, ni potencia, ni corriente,
      // solo un nombre) — usuario, 2026-11-28, probando con una memoria
      // técnica real: la IA local confundió los DISPOSITIVOS del cuadro
      // general (ICP, IGA, diferencial, protector de sobretensiones) con
      // circuitos reales, generando "circuitos" huérfanos de 0W (la
      // sección de dispositivos del cuadro no tiene datos de carga, a
      // diferencia de la tabla real de circuitos — ver la regla nueva en
      // ollamaClient.ts). Ya se avisa con el mensaje de abajo, pero un
      // circuito así de vacío no se pre-marca para incluir — mejor que
      // el usuario lo revise/descarte a mano a que un click de "importar
      // todo" cree 5 circuitos fantasma sin que se note.
      const sinNingunDato = c.potencia_w == null && c.corriente_a == null && c.voltaje_v == null;
      // Segunda vuelta de este mismo bug (usuario, 2026-11-28, mismo PDF
      // REBT): el nombre SÍ coincide con un dispositivo del cuadro (ver
      // pareceDispositivoDelCuadro arriba) y no trae potencia propia —
      // aunque traiga una corriente, esa corriente es la nominal DEL
      // DISPOSITIVO, nunca una carga a aproximar (ver nota arriba de
      // PATRONES_DISPOSITIVO_CUADRO).
      const esDispositivoSinCarga = c.potencia_w == null && pareceDispositivoDelCuadro(c.descripcion);

      let voltaje = c.voltaje_v;
      if (voltaje == null) {
        voltaje = t.tension_v ?? primerVoltajeEstandar(normativaActiva, fases) ?? 120;
        advertencias.push(`Sin voltaje en el documento — se usó ${voltaje}V por defecto, revisar.`);
      } else {
        // Bug real reportado por el usuario (2026-11-28, probando con
        // un PDF de otra normativa a la seleccionada): el voltaje que
        // trae el documento se usa TAL CUAL (nunca se fuerza al de la
        // normativa activa — podría ser el dato real), pero si no
        // figura en la lista de voltajes estándar de esa normativa es
        // una señal fuerte de que el documento es de otra normativa, y
        // antes pasaba desapercibido. Solo avisa, nunca bloquea — el
        // usuario decide con el checkbox de "incluir" en la vista previa.
        const estandares = App.normativa.voltajesPorFase(normativaActiva, fases);
        if (estandares.length > 0 && !estandares.includes(voltaje)) {
          advertencias.push(
            `${voltaje}V no es un voltaje estándar de ${normativaActiva} para fase ${fases} (esperado: ${estandares.join("/")}V) — revisar si el documento corresponde a otra normativa.`
          );
        }
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
      } else if (esDispositivoSinCarga) {
        // NO se usa c.corriente_a como aproximación de carga acá (a
        // diferencia de la rama de abajo) — es la corriente NOMINAL del
        // dispositivo (ICP/IGA/diferencial/DPS/PIA...), no la de ninguna
        // carga real, usarla así fabrica una demanda que no existe.
        advertencias.push(
          `"${c.descripcion}" parece ser un DISPOSITIVO de protección del cuadro general (ICP, interruptor general, diferencial, protector de sobretensiones, PIA), no un circuito con carga propia${
            c.corriente_a != null ? ` — su corriente nominal (${c.corriente_a}A) NO se usó como aproximación de carga, para no inventar una demanda que no existe` : ""
          }. El circuito se crea sin carga — revisar contra el documento antes de incluirlo, por eso no viene premarcado.`
        );
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
      } else if (sinNingunDato) {
        advertencias.push(
          `"${c.descripcion}" no tiene NINGÚN dato numérico (ni voltaje, ni potencia, ni corriente) — probablemente el documento describe acá un DISPOSITIVO del tablero (ICP, interruptor general, diferencial, protector de sobretensiones) y no un circuito real con carga propia. Revisar contra el documento antes de incluirlo — por eso no viene premarcado.`
        );
      } else {
        advertencias.push("Sin potencia ni corriente en el documento — el circuito se crea sin carga, hay que agregarla a mano.");
      }

      // Con potencia Y breaker dados a la vez (el caso más confiable,
      // ambos de columnas distintas del documento), se cruzan entre sí
      // — ver nota de corrienteCargaAproximadaA arriba.
      if (c.potencia_w != null && c.corriente_a != null) {
        const cargaAprox = corrienteCargaAproximadaA(c.potencia_w, voltaje, fases);
        if (cargaAprox != null) {
          if (c.corriente_a < cargaAprox * 0.95) {
            advertencias.push(
              `El breaker que da el documento (${c.corriente_a}A) es MENOR que la corriente estimada de esta carga (≈${cargaAprox.toFixed(1)}A, de ${c.potencia_w}W a ${voltaje}V) — revisar contra el documento original, puede ser un error de extracción.`
            );
          } else if (c.corriente_a > cargaAprox * FACTOR_BREAKER_MAXIMO_RAZONABLE) {
            advertencias.push(
              `El breaker que da el documento (${c.corriente_a}A) parece desproporcionado para esta carga (≈${cargaAprox.toFixed(1)}A, de ${c.potencia_w}W a ${voltaje}V) — revisar contra el documento original, puede confundirse con la corriente de diseño de toda la acometida en vez de la de este circuito.`
            );
          }
        }
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
        incluir: !errorValidacion && !sinNingunDato && !esDispositivoSinCarga,
      };
    });

    return { nombre: t.nombre, datos: datosTablero, circuitos };
  });
}
