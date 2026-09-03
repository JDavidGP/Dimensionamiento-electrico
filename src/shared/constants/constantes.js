// Límites y factores usados en los cálculos eléctricos.
// Centralizados aquí para que un ajuste futuro (ej. al incorporar
// las tablas oficiales del CIEN) no requiera tocar la lógica de cálculo.

export const LIMITE_CAIDA_TENSION_PCT = 3.0; // % máximo de caída de tensión permitido
export const FACTOR_CARGA_CONTINUA = 1.25; // Regla del 125% para cargas continuas (>3h)

// Límite de caída de tensión ACUMULADA (alimentador + circuito derivado
// sumados). CONFIRMADO con fuente — no es una cifra sin respaldo:
//   - NEC 210.19(A) Nota informativa N.° 4 (circuito derivado): ≤3% en
//     el punto de utilización más alejado.
//   - NEC 215.2(A)(1) Nota informativa N.° 2 (alimentador): ≤3% en el
//     alimentador, y que la suma alimentador + circuito derivado no
//     supere el 5% combinado.
// Verificado por dos vías independientes: la cita que se usó para tomar
// la decisión de diseño, y una búsqueda propia posterior — ambas
// coinciden en el mismo número y la misma ubicación en el Code.
//
// IMPORTANTE — es una NOTA INFORMATIVA, no un artículo exigible: NEC §90.5
// define las notas informativas como "solo informativas, no exigibles
// como requisito". El 3%/5% es una recomendación para "eficiencia
// razonable de operación", no un límite de seguridad obligatorio como sí
// lo son la ampacidad o la capacidad de interrupción del breaker. Varias
// AHJ (jurisdicciones locales, EE.UU.) SÍ lo adoptan como exigencia vía
// enmienda propia — acá se adopta como política de diseño por defecto
// del proyecto, prudente aunque no sea obligatoria en todos lados.
//
// Sigue nombrada PROVISIONAL porque es una política DEL PROYECTO que
// podría afinarse para casos especiales (media tensión, transformadores,
// otra jurisdicción con su propio límite normativo) — NO porque la cifra
// esté sin verificar. NO reemplaza normativa.limiteCaidaTensionPct (el 3%
// por tramo individual, que sigue aplicándose sin cambios en
// seleccionarSeccion.js) — es un chequeo ADICIONAL sobre la suma de
// ambos tramos. Ver modules/motor/caidaTensionAcumulada.js.
export const LIMITE_CAIDA_TENSION_ACUMULADA_PROVISIONAL_PCT = 5.0;

// Umbral de desbalance de corriente entre líneas (L1/L2/L3) de un
// tablero. SIN DECIDIR TODAVÍA — a diferencia de LIMITE_CAIDA_TENSION_
// ACUMULADA_PROVISIONAL_PCT (que sí tiene cita NEC exacta), este número
// NO tiene artículo del NEC que lo fije: el NEC 210.11(B) exige repartir
// las cargas entre líneas pero no fija un % — el 10-20% que circula en
// la práctica de la industria viene de IEEE Std 141 (Red Book) y de
// normas NEMA para motores (NEMA MG-1: 1% de desbalance de TENSIÓN ya
// empieza a deratear un motor; a partir de 5% no se recomienda operar),
// no del Code eléctrico en sí. Es una convención de buena práctica, no
// un límite exigible.
// Valor puesto acá (10%) es el extremo más conservador de esa práctica
// citada — un default de referencia para poder programar y probar el
// motor de cálculo, NO una decisión final. Pendiente confirmar con el
// usuario antes de tratarlo como definitivo (ver conversación de diseño
// de la sesión de balance de fases).
export const UMBRAL_DESBALANCE_FASES_PCT = 10.0;

export const MIN_COSPHI = 0.5;
export const MAX_COSPHI = 1.0;

export const MIN_TEMP_C = -10;
export const MAX_TEMP_C = 60;
