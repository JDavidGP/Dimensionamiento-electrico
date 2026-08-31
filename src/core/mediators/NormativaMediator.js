/**
 * NormativaMediator
 * Responsabilidad: exponer parámetros normativos al resto de la app.
 * Dependencias: Repository, Cache (vía catálogo interno).
 * NO conoce: UI, motor de cálculo, documentos, diagramas.
 */
import {
  CATALOGO_NORMATIVAS,
  LISTA_NORMATIVAS,
  obtenerNormativaPorId,
} from "../../modules/normativa/index.js";
import { Cache } from "../services/Cache.js";
import { Logger } from "../services/Logger.js";
import { Config } from "../services/Config.js";

const CACHE_KEY = "normativa:activa:";

export const NormativaMediator = {
  /** Lista de normativas seleccionables (para UI). */
  listar() {
    return LISTA_NORMATIVAS.map((n) => ({
      id: n.id,
      nombre: n.nombre,
      familia: n.familia,
      validado: n.validado,
      notaValidacion: n.notaValidacion,
    }));
  },

  /** Objeto completo de normativa (para inyectar al motor). */
  obtener(id) {
    const key = CACHE_KEY + (id || Config.normativaPorDefecto);
    if (Cache.has(key)) return Cache.get(key);
    const normativa = obtenerNormativaPorId(id || Config.normativaPorDefecto);
    Cache.set(key, normativa);
    return normativa;
  },

  /** Catálogo crudo (solo para tests / debug). */
  catalogo() {
    return CATALOGO_NORMATIVAS;
  },

  /** Voltajes sugeridos según fases. */
  voltajesPorFase(normativaId, fases) {
    const n = this.obtener(normativaId);
    return n.voltajesPorFase?.[fases] ?? [];
  },

  /** Parámetro puntual (ampacidad, breakers, etc.). */
  parametro(normativaId, campo) {
    const n = this.obtener(normativaId);
    return n?.[campo];
  },

  /**
   * Gancho futuro: verificación normativa explícita de un circuito.
   * Hoy las reglas viven dentro del dimensionamiento del motor.
   */
  verificarCircuito(normativaId, circuito, contexto = {}) {
    const n = this.obtener(normativaId);
    if (typeof n.verificarCircuito === "function") {
      return n.verificarCircuito(circuito, contexto);
    }
    return { ok: true, mensajes: [] };
  },

  invalidateCache() {
    Cache.keys()
      .filter((k) => k.startsWith("normativa:"))
      .forEach((k) => Cache.delete(k));
    Logger.debug("NormativaMediator cache invalidada");
  },
};
