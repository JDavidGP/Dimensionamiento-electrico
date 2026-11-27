/**
 * Repository — acceso a datos de referencia (tablas estáticas).
 * No realiza cálculos. Usado por NormativaMediator y DataProvider.
 */
import { BREAKERS_COMERCIALES } from "../../shared/data/breakers.ts";
import * as materiales from "../../shared/data/materiales.ts";
import * as secciones from "../../shared/data/seccionesConductor.ts";
import * as tiposEquipo from "../../shared/data/tiposEquipoNEC.ts";
import { CIRCUITO_VACIO, EQUIPO_VACIO, TABLERO_VACIO } from "../../shared/data/plantillas.ts";
import type { FormularioCircuito, FormularioEquipo } from "../../modules/validacion/formularios.ts";
import type { FormularioTablero } from "../../shared/data/plantillas.ts";
import { Cache } from "./Cache.ts";
import { Logger } from "./Logger.ts";

export interface Plantillas {
  CIRCUITO_VACIO: FormularioCircuito;
  EQUIPO_VACIO: FormularioEquipo;
  TABLERO_VACIO: FormularioTablero;
}

const KEYS = {
  breakers: "repo:breakers",
  materiales: "repo:materiales",
  secciones: "repo:secciones",
  tiposEquipo: "repo:tiposEquipo",
  plantillas: "repo:plantillas",
};

export const Repository = {
  getBreakers(): number[] {
    if (!Cache.has(KEYS.breakers)) Cache.set(KEYS.breakers, BREAKERS_COMERCIALES);
    return Cache.get<number[]>(KEYS.breakers)!;
  },

  getMateriales(): typeof materiales {
    if (!Cache.has(KEYS.materiales)) Cache.set(KEYS.materiales, materiales);
    return Cache.get<typeof materiales>(KEYS.materiales)!;
  },

  getSeccionesConductor(): typeof secciones {
    if (!Cache.has(KEYS.secciones)) Cache.set(KEYS.secciones, secciones);
    return Cache.get<typeof secciones>(KEYS.secciones)!;
  },

  getTiposEquipo(): typeof tiposEquipo {
    if (!Cache.has(KEYS.tiposEquipo)) Cache.set(KEYS.tiposEquipo, tiposEquipo);
    return Cache.get<typeof tiposEquipo>(KEYS.tiposEquipo)!;
  },

  getPlantillas(): Plantillas {
    if (!Cache.has(KEYS.plantillas)) {
      Cache.set(KEYS.plantillas, { CIRCUITO_VACIO, EQUIPO_VACIO, TABLERO_VACIO });
    }
    return Cache.get<Plantillas>(KEYS.plantillas)!;
  },

  /** Invalidar caché de tablas (p.ej. tras cargar tablas externas). */
  invalidate(key?: string): void {
    if (key) {
      Cache.delete(`repo:${key}`);
      Logger.debug(`Repository.invalidate(${key})`);
    } else {
      Object.values(KEYS).forEach((k) => Cache.delete(k));
      Logger.debug("Repository.invalidate(all)");
    }
  },
};
