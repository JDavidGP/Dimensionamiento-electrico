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
} from "../../modules/normativa/index.ts";
import type { Normativa, Fases } from "../../modules/normativa/tipos.ts";
import type { Circuito, Equipo, ResultadoVerificacionNormativa, NormativaEngine } from "../../modules/validacion/tipos.ts";
import { Cache } from "../services/Cache.ts";
import { Config } from "../services/Config.ts";

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
  obtener(id?: string | null): Normativa {
    const key = CACHE_KEY + (id || Config.normativaPorDefecto);
    if (Cache.has(key)) return Cache.get<Normativa>(key)!;
    const normativa = obtenerNormativaPorId(id || Config.normativaPorDefecto);
    Cache.set(key, normativa);
    return normativa;
  },

  /** Catálogo crudo (solo para tests / debug). */
  catalogo() {
    return CATALOGO_NORMATIVAS;
  },

  /** Voltajes sugeridos según fases. */
  voltajesPorFase(normativaId: string | null | undefined, fases: Fases): number[] {
    const n = this.obtener(normativaId);
    return n.voltajesPorFase?.[fases] ?? [];
  },

  /**
   * Gancho futuro: verificación normativa explícita de un circuito.
   * Hoy las reglas viven dentro del dimensionamiento del motor.
   */
  verificarCircuito(normativaId: string | null | undefined, circuito: Circuito, contexto: { corriente: number; breaker: number | string | null; calibre: string | null; equipos: Equipo[] }): ResultadoVerificacionNormativa {
    // Normativa no declara `verificarCircuito` en su contrato (Normativa,
    // modules/normativa/tipos.ts) porque NINGUNA normativa real lo
    // implementa todavía (ver comentario del método) — el cast acá solo
    // declara ese gancho OPCIONAL (mismo shape que NormativaEngine, que
    // modules/validacion/electrica.ts ya espera recibir), nunca inventa
    // un dato nuevo.
    const n = this.obtener(normativaId) as Normativa & NormativaEngine;
    if (typeof n.verificarCircuito === "function") {
      return n.verificarCircuito(circuito, contexto) ?? { ok: true, mensajes: [] };
    }
    return { ok: true, mensajes: [] };
  },
};
