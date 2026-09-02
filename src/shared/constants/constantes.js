// Límites y factores usados en los cálculos eléctricos.
// Centralizados aquí para que un ajuste futuro (ej. al incorporar
// las tablas oficiales del CIEN) no requiera tocar la lógica de cálculo.

export const LIMITE_CAIDA_TENSION_PCT = 3.0; // % máximo de caída de tensión permitido
export const FACTOR_CARGA_CONTINUA = 1.25; // Regla del 125% para cargas continuas (>3h)

// PROVISIONAL — decisión normativa tomada, no definitiva. Límite de caída
// de tensión ACUMULADA (alimentador + circuito derivado sumados), basado
// en la nota informativa de NEC 210.19(A) (3% circuito + 3% alimentador,
// tope combinado sugerido 5% — es una recomendación de la nota informativa,
// no un límite exigido por artículo como sí lo es el 3% por tramo).
// NO reemplaza normativa.limiteCaidaTensionPct (el 3% por tramo individual,
// que sigue aplicándose sin cambios en seleccionarSeccion.js) — es un
// chequeo ADICIONAL sobre la suma de ambos tramos.
// Pendiente de revisar cuando se decida algo más preciso (ver
// modules/motor/caidaTensionAcumulada.js y ruta-guia-unificada.txt,
// Fase 4 — "Decisión normativa pendiente" / "Punto de referencia del %").
export const LIMITE_CAIDA_TENSION_ACUMULADA_PROVISIONAL_PCT = 5.0;

export const MIN_COSPHI = 0.5;
export const MAX_COSPHI = 1.0;

export const MIN_TEMP_C = -10;
export const MAX_TEMP_C = 60;
