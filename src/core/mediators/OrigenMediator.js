/**
 * OrigenMediator
 * Responsabilidad: dominio Origen — de dónde viene la alimentación de
 * un tablero (acometida, otro tablero, o una fuente de energía
 * propia: Batería/Generador). CRUD de fuentes de energía + resolución
 * de un origenId contra ambos catálogos (tableros y fuentesEnergia).
 *
 * Mismo criterio que TableroMediator: NO muta el proyecto. Devuelve
 * datos ya calculados/transformados; la escritura real la hace la
 * capa de aplicación (hook).
 *
 * Dependencias permitidas: funciones internas de modules/origen. Lo
 * que sigue prohibido: UI, Documento, Diagrama.
 */
import {
  resolverOrigen,
  crearFuenteEnergia,
  editarFuenteEnergia,
  liberarTablerosDeFuente,
  TIPOS_FUENTE_ENERGIA,
  ROLES_FUENTE_ENERGIA,
  MODOS_CONMUTACION,
  CONMUTACION_VACIA,
  normalizarConmutacion,
} from "../../modules/origen/index.js";

export const OrigenMediator = {
  // Enums expuestos para la UI — mismo patrón que ValidacionMediator.ESTADOS.
  TIPOS_FUENTE_ENERGIA,
  ROLES_FUENTE_ENERGIA,
  MODOS_CONMUTACION,
  CONMUTACION_VACIA,

  /** Fábrica de una fuente de energía nueva (no la guarda — eso lo hace el hook). */
  crearFuente(datos) {
    return crearFuenteEnergia(datos);
  },

  /** Devuelve la fuente editada; el hook decide cómo guardarla. */
  editarFuente(fuente, cambios) {
    return editarFuenteEnergia(fuente, cambios);
  },

  /** Al eliminar una fuente, los tableros que la tenían como padre quedan libres (null), no rotos. */
  liberarTableros(fuenteId, tableros) {
    return liberarTablerosDeFuente(fuenteId, tableros ?? []);
  },

  /** Resuelve qué es un origenId (tableroPadreId) contra ambos catálogos. */
  resolver(origenId, tableros, fuentesEnergia) {
    return resolverOrigen(origenId, tableros ?? [], fuentesEnergia ?? []);
  },

  /** Normaliza un esquema de conmutación (tablero.conmutacion) antes de guardarlo. */
  normalizarConmutacion(datos) {
    return normalizarConmutacion(datos);
  },
};
