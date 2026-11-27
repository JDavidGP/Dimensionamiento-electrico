// src/modules/diagrama/index.ts
//
// Módulo Diagrama — modelo de datos del diagrama unifilar (Nodo +
// Conexión). FASE 1 ("Motor de datos" + cardinalidad) y FASE 2 (motor
// de reglas eléctricas semántico, ver reglas.js) de la spec larga del
// usuario ("Diagrama unifilar", 2026-11-20) ya están construidas.
// TODAVÍA NO incluye:
//   - Motor de dibujo (SVG, símbolos) — eso es UI, no este módulo.
//   - Motor de autoorganización (layout automático) — idem.
//   - Editor visual (drag & drop) — idem.
// Esos son "los detalles", para una próxima ronda.
//
// MODELO CANÓNICO (ARCHITECTURE.md §9, "anti-bucle tabla ↔ diagrama"):
// el diagrama es una VISTA sobre circuitos/equipos/tableros/
// fuentesEnergia, no una copia paralela. Un Nodo cuyo tipo tiene
// `entidadVinculada` en el catálogo (ver shared/data/
// bibliotecaComponentes.js) debe, cuando corresponda, REFERENCIAR esa
// entidad real por id (`nodo.entidadId`) — la electricidad real sigue
// viviendo en esa entidad (tablero/circuito/equipo/fuenteEnergia), el
// nodo solo le agrega posición y pertenencia al dibujo. Un nodo de un
// tipo SIN entidad vinculada (protección/control, por ahora) es
// puramente de diagrama: documenta topología, no alimenta ningún
// cálculo todavía — mismo criterio ya usado para fuentesEnergia y
// conmutación (registrar primero, calcular después).
//
// CERO gráfico, cero UI. Módulo puro — se usa a través de
// DiagramaMediator (core/mediators/DiagramaMediator.js).

import { generarId } from "../../shared/utils/id.ts";
import { obtenerComponente } from "../../shared/data/bibliotecaComponentes.ts";
import { validarReglaElectrica } from "./reglas.ts";
import type { NodoDiagrama, DatosNodo, ConexionDiagrama, DatosConexion, ResultadoValidacion } from "./tipos.ts";

export const NODO_VACIO: Omit<NodoDiagrama, "id"> = {
  tipo: "", // id del catálogo (shared/data/bibliotecaComponentes.ts)
  nombre: "",
  posicion: { x: 0, y: 0 },
  // Si el tipo tiene entidadVinculada, el id de la entidad real
  // (tablero/circuito/equipo/fuenteEnergia) que este nodo representa
  // en el dibujo. null = sin vincular (válido incluso cuando el tipo
  // SÍ admite vínculo — el usuario puede dibujar el nodo antes de
  // crear la entidad real, o el tipo simplemente no tiene una
  // todavía, ej. transformador).
  entidadId: null,
  // Datos propios del nodo — complementa (no reemplaza) los de la
  // entidad vinculada si la hay; es la única fuente para tipos sin
  // entidad vinculada (protección/control). Forma libre a propósito,
  // sin validar campo por campo todavía — ver nota de alcance arriba.
  propiedades: {},
  estado: "activo", // activo | desactivado | falla
};

export const CONEXION_VACIA: Omit<ConexionDiagrama, "id"> = {
  nodoOrigenId: "",
  nodoDestinoId: "",
  tipoConductor: "cable", // "cable" | "barra" — lo suficiente para distinguir un conductor de una barra de distribución
  longitud: "",
  calibre: "", // AWG/kcmil — reusa AREA_MM2_POR_AWG (shared/data/seccionesConductor.ts) cuando se calcule, no se recalcula acá
  material: "cobre",
  fases: "mono", // "mono" | "bi" | "tri" — mismo vocabulario que circuito/tablero
  notas: "",
};

function normalizarNodo(datos: DatosNodo = {}): Omit<NodoDiagrama, "id"> {
  const posicion = datos.posicion && typeof datos.posicion === "object" ? datos.posicion : { x: 0, y: 0 };
  return {
    tipo: datos.tipo || "",
    nombre: datos.nombre?.trim() || "",
    posicion: { x: Number(posicion.x) || 0, y: Number(posicion.y) || 0 },
    entidadId: datos.entidadId || null,
    propiedades: datos.propiedades && typeof datos.propiedades === "object" ? datos.propiedades : {},
    estado: datos.estado || "activo",
  };
}

export function crearNodo(datos: DatosNodo): NodoDiagrama {
  return { id: generarId(), ...normalizarNodo(datos) };
}

/** Devuelve el nodo con los cambios aplicados — no muta el original (mismo criterio que editarTablero). */
export function editarNodo(nodo: NodoDiagrama, cambios: DatosNodo): NodoDiagrama {
  return { ...nodo, ...normalizarNodo({ ...nodo, ...cambios }) };
}

function normalizarConexion(datos: DatosConexion = {}): Omit<ConexionDiagrama, "id"> {
  return {
    nodoOrigenId: datos.nodoOrigenId || "",
    nodoDestinoId: datos.nodoDestinoId || "",
    tipoConductor: datos.tipoConductor || "cable",
    longitud: datos.longitud === "" || datos.longitud == null ? "" : Number(datos.longitud) || 0,
    calibre: datos.calibre || "",
    material: datos.material?.toLowerCase() || "cobre",
    fases: datos.fases || "mono",
    notas: datos.notas || "",
  };
}

export function crearConexion(datos: DatosConexion): ConexionDiagrama {
  return { id: generarId(), ...normalizarConexion(datos) };
}

export function editarConexion(conexion: ConexionDiagrama, cambios: DatosConexion): ConexionDiagrama {
  return { ...conexion, ...normalizarConexion({ ...conexion, ...cambios }) };
}

/**
 * Al eliminar un nodo, sus conexiones (las que lo tienen como origen O
 * destino) dejan de tener sentido — a diferencia de "liberar" un
 * tablero padre (que puede quedar en null y seguir siendo válido), acá
 * se ELIMINAN directamente: una conexión sin uno de sus dos extremos
 * no es un dato parcial válido, es basura.
 */
export function eliminarConexionesDeNodo(nodoId: string, conexiones: ConexionDiagrama[] = []): ConexionDiagrama[] {
  return conexiones.filter((c) => c.nodoOrigenId !== nodoId && c.nodoDestinoId !== nodoId);
}

/**
 * Al eliminar una entidad real (tablero/equipo/fuenteEnergia), los
 * nodos del diagrama que la tenían como `entidadId` quedan SIN vincular
 * (null) — no apuntando a un id muerto. El nodo sigue existiendo (es
 * dato de diagrama, no se borra solo porque su vínculo desapareció),
 * mismo criterio que liberarTablerosDeFuente / liberarCircuitosDeTablero
 * en los otros módulos de dominio.
 */
export function liberarNodosDeEntidad(entidadId: string, nodos: NodoDiagrama[] = []): NodoDiagrama[] {
  return nodos.map((n) => (n.entidadId === entidadId ? { ...n, entidadId: null } : n));
}

/**
 * Valida una conexión propuesta ANTES de crearla — "Evita errores de
 * diseño antes de que ocurran" (spec del usuario). Combina lo
 * estructuralmente imposible (nodo inexistente, auto-conexión,
 * conexión duplicada), compatibilidad SEMÁNTICA entre tipos (Fase 2,
 * ver reglas.js — ej. "un motor no puede conectarse directo a un
 * medidor") y cardinalidad (Fase 1, cuántas entradas/salidas admite
 * cada tipo según el catálogo).
 */
export function validarConexion(
  conexionPropuesta: { nodoOrigenId: string; nodoDestinoId: string },
  nodos: NodoDiagrama[] = [],
  conexionesExistentes: ConexionDiagrama[] = []
): ResultadoValidacion {
  const { nodoOrigenId, nodoDestinoId } = conexionPropuesta;

  if (!nodoOrigenId || !nodoDestinoId) {
    return { valido: false, motivo: "Falta el nodo de origen o de destino." };
  }
  if (nodoOrigenId === nodoDestinoId) {
    return { valido: false, motivo: "Un nodo no puede conectarse a sí mismo." };
  }

  const origen = nodos.find((n) => n.id === nodoOrigenId);
  const destino = nodos.find((n) => n.id === nodoDestinoId);
  if (!origen) return { valido: false, motivo: `El nodo de origen (${nodoOrigenId}) no existe.` };
  if (!destino) return { valido: false, motivo: `El nodo de destino (${nodoDestinoId}) no existe.` };

  const reglaElectrica = validarReglaElectrica(origen.tipo, destino.tipo);
  if (!reglaElectrica.valido) {
    return reglaElectrica;
  }

  const yaExiste = conexionesExistentes.some((c) => c.nodoOrigenId === nodoOrigenId && c.nodoDestinoId === nodoDestinoId);
  if (yaExiste) {
    return { valido: false, motivo: "Ya existe una conexión idéntica entre estos dos nodos." };
  }

  const compOrigen = obtenerComponente(origen.tipo);
  const compDestino = obtenerComponente(destino.tipo);

  if (compOrigen) {
    const salidasUsadas = conexionesExistentes.filter((c) => c.nodoOrigenId === nodoOrigenId).length;
    if (salidasUsadas >= compOrigen.puntosConexion.salidas) {
      return {
        valido: false,
        motivo: `"${compOrigen.nombre}" ya usa sus ${compOrigen.puntosConexion.salidas === Infinity ? "" : compOrigen.puntosConexion.salidas} salida(s) disponible(s).`,
      };
    }
  }

  if (compDestino) {
    const entradasUsadas = conexionesExistentes.filter((c) => c.nodoDestinoId === nodoDestinoId).length;
    if (entradasUsadas >= compDestino.puntosConexion.entradas) {
      return {
        valido: false,
        motivo: `"${compDestino.nombre}" ya usa sus ${compDestino.puntosConexion.entradas === Infinity ? "" : compDestino.puntosConexion.entradas} entrada(s) disponible(s) (ej. un interruptor principal solo admite 1).`,
      };
    }
  }

  return { valido: true };
}

export { validarReglaElectrica } from "./reglas.ts";
export { autoorganizarNodos } from "./autoorganizar.ts";
export { elegirSimboloEquipo } from "./seleccionSimbolo.ts";
export type { NodoDiagrama, DatosNodo, ConexionDiagrama, DatosConexion, ResultadoValidacion, Componente } from "./tipos.ts";
export type { NodoConId, ConexionSimple, OpcionesAutoorganizar } from "./autoorganizar.ts";
