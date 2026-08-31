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
