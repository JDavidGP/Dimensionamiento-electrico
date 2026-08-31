/**
 * Repository — acceso a datos de referencia (tablas estáticas).
 * No realiza cálculos. Usado por NormativaMediator y DataProvider.
 */
import { BREAKERS_COMERCIALES } from "../../shared/data/breakers.js";
import * as materiales from "../../shared/data/materiales.js";
import * as secciones from "../../shared/data/seccionesConductor.js";
import * as tiposEquipo from "../../shared/data/tiposEquipoNEC.js";
import { CIRCUITO_VACIO, EQUIPO_VACIO, TABLERO_VACIO } from "../../shared/data/plantillas.js";
import { Cache } from "./Cache.js";
import { Logger } from "./Logger.js";

const KEYS = {
  breakers: "repo:breakers",
  materiales: "repo:materiales",
  secciones: "repo:secciones",
  tiposEquipo: "repo:tiposEquipo",
  plantillas: "repo:plantillas",
};

export const Repository = {
  getBreakers() {
    if (!Cache.has(KEYS.breakers)) Cache.set(KEYS.breakers, BREAKERS_COMERCIALES);
    return Cache.get(KEYS.breakers);
  },

  getMateriales() {
    if (!Cache.has(KEYS.materiales)) Cache.set(KEYS.materiales, materiales);
    return Cache.get(KEYS.materiales);
  },

  getSeccionesConductor() {
    if (!Cache.has(KEYS.secciones)) Cache.set(KEYS.secciones, secciones);
    return Cache.get(KEYS.secciones);
  },

  getTiposEquipo() {
    if (!Cache.has(KEYS.tiposEquipo)) Cache.set(KEYS.tiposEquipo, tiposEquipo);
    return Cache.get(KEYS.tiposEquipo);
  },

  getPlantillas() {
    if (!Cache.has(KEYS.plantillas)) {
      Cache.set(KEYS.plantillas, { CIRCUITO_VACIO, EQUIPO_VACIO, TABLERO_VACIO });
    }
    return Cache.get(KEYS.plantillas);
  },

  /** Invalidar caché de tablas (p.ej. tras cargar tablas externas). */
  invalidate(key) {
    if (key) {
      Cache.delete(`repo:${key}`);
      Logger.debug(`Repository.invalidate(${key})`);
    } else {
      Object.values(KEYS).forEach((k) => Cache.delete(k));
      Logger.debug("Repository.invalidate(all)");
    }
  },
};
