// Límites y factores usados en los cálculos eléctricos.
// Centralizados aquí para que un ajuste futuro (ej. al incorporar
// las tablas oficiales del CIEN) no requiera tocar la lógica de cálculo.

export const LIMITE_CAIDA_TENSION_PCT = 3.0; // % máximo de caída de tensión permitido
export const FACTOR_CARGA_CONTINUA = 1.25; // Regla del 125% para cargas continuas (>3h)

export const MIN_COSPHI = 0.5;
export const MAX_COSPHI = 1.0;

export const MIN_TEMP_C = -10;
export const MAX_TEMP_C = 60;
