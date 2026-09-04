/**
 * Configuración global de la aplicación.
 * Valores por defecto; pueden sobrescribirse en runtime.
 */
export const Config = {
  formatoVersion: 1,
  normativaPorDefecto: "NEC",
  idioma: "es",
  limites: {
    caidaTensionPct: 3.0,
    factorCargaContinua: 1.25,
    // Umbral recomendado de desbalance de fases (10%, ver constantes.js
    // para la fuente/justificación). Modificable por proyecto vía
    // Config.set({ limites: { desbalanceFasesPct: N } }) — subirlo
    // dispara una advertencia seria en balanceFases(), no lo hace en
    // silencio.
    desbalanceFasesPct: 10.0,
  },
  features: {
    diagrama: false,
    documentoPdf: false,
    sqlite: false,
  },
  set(partial) {
    Object.assign(this, partial);
    if (partial.limites) Object.assign(this.limites, partial.limites);
    if (partial.features) Object.assign(this.features, partial.features);
  },
};
