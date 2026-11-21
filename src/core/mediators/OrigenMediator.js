/**
 * OrigenMediator
 * Responsabilidad: dominio Origen — de dónde viene la alimentación de
 * un tablero (acometida, otro tablero, una fuente de energía propia
 * Batería/Generador, o un Transformador — este último solo cuando la
 * instalación es industrial, ver PanelTableros.jsx). CRUD de fuentes de
 * energía y de transformadores + resolución de un origenId contra los
 * tres catálogos (tableros, fuentesEnergia, transformadores).
 *
 * Mismo criterio que TableroMediator: NO muta el proyecto. Devuelve
 * datos ya calculados/transformados; la escritura real la hace la
 * capa de aplicación (hook).
 *
 * Dependencias permitidas: funciones internas de modules/origen y de
 * modules/motor/transformador.js (la entidad Transformador vive ahí,
 * junto a su único cálculo de identidad — corrientes nominales — no se
 * duplicó acá; cruzar hacia ese módulo puro está permitido a nivel
 * mediador, ver ARCHITECTURE.md §11, mismo patrón que
 * DiagramaMediator → OrigenMediator). Lo que sigue prohibido: UI,
 * Documento, Diagrama.
 */
import {
  resolverOrigen,
  crearFuenteEnergia,
  editarFuenteEnergia,
  liberarTablerosDeFuente,
  limpiarRolDuplicado,
  TIPOS_FUENTE_ENERGIA,
  ROLES_FUENTE,
  MODOS_CONMUTACION,
  CONMUTACION_VACIA,
  normalizarConmutacion,
} from "../../modules/origen/index.js";
import {
  TRANSFORMADOR_VACIO,
  crearTransformador,
  editarTransformador,
  liberarTablerosDeTransformador,
} from "../../modules/motor/transformador.ts";

export const OrigenMediator = {
  // Enums expuestos para la UI — mismo patrón que ValidacionMediator.ESTADOS.
  TIPOS_FUENTE_ENERGIA,
  ROLES_FUENTE,
  MODOS_CONMUTACION,
  CONMUTACION_VACIA,
  TRANSFORMADOR_VACIO,

  /** Fábrica de una fuente de energía nueva (no la guarda — eso lo hace el hook). */
  crearFuente(datos) {
    return crearFuenteEnergia(datos);
  },

  /** Devuelve la fuente editada; el hook decide cómo guardarla. */
  editarFuente(fuente, cambios) {
    return editarFuenteEnergia(fuente, cambios);
  },

  /** Deja a lo sumo una fuente con `rol` (se lo quita a cualquier otra que lo tuviera). */
  limpiarRolDuplicado(fuentes, fuenteId, rol) {
    return limpiarRolDuplicado(fuentes ?? [], fuenteId, rol);
  },

  /** Al eliminar una fuente, los tableros que la tenían como padre quedan libres (null), no rotos. */
  liberarTableros(fuenteId, tableros) {
    return liberarTablerosDeFuente(fuenteId, tableros ?? []);
  },

  /** Fábrica de un transformador nuevo (no lo guarda — eso lo hace el hook). */
  crearTransformador(datos) {
    return crearTransformador(datos);
  },

  /** Devuelve el transformador editado; el hook decide cómo guardarlo. */
  editarTransformador(transformador, cambios) {
    return editarTransformador(transformador, cambios);
  },

  /** Al eliminar un transformador, los tableros que lo tenían como padre quedan libres (null), no rotos. */
  liberarTablerosDeTransformador(transformadorId, tableros) {
    return liberarTablerosDeTransformador(transformadorId, tableros ?? []);
  },

  /** Resuelve qué es un origenId (tableroPadreId) contra los tres catálogos. */
  resolver(origenId, tableros, fuentesEnergia, transformadores) {
    return resolverOrigen(origenId, tableros ?? [], fuentesEnergia ?? [], transformadores ?? []);
  },

  /** Normaliza un esquema de conmutación (tablero.conmutacion) antes de guardarlo. */
  normalizarConmutacion(datos) {
    return normalizarConmutacion(datos);
  },
};
