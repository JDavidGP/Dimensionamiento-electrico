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

// Umbral RECOMENDADO de desbalance de corriente entre líneas (L1/L2/L3)
// de un tablero. CONFIRMADO por el usuario como valor por defecto del
// proyecto (10%) — a diferencia de LIMITE_CAIDA_TENSION_ACUMULADA_
// PROVISIONAL_PCT (que tiene cita NEC exacta), este número NO tiene
// artículo del NEC que lo fije: el NEC 210.11(B) exige repartir las
// cargas entre líneas pero no fija un %. El 10-20% que circula en la
// práctica de la industria viene de IEEE Std 141 (Red Book) y de
// normas NEMA para motores (NEMA MG-1: un desbalance de TENSIÓN de 1%
// ya empieza a deratear un motor trifásico — a 5% la capacidad cae a
// ~75%, y no se recomienda operar por encima de ese punto). 10% es el
// extremo más conservador de esa práctica citada.
//
// MODIFICABLE en runtime — Config.limites.desbalanceFasesPct (ver
// core/services/Config.js) empieza igual a este valor pero se puede
// sobrescribir por proyecto. balanceFases() (modules/motor) genera una
// ADVERTENCIA SERIA cuando el umbral efectivamente usado supera este
// valor recomendado — subir el margen no es gratis: más desbalance de
// corriente sostenido calienta el neutro en circuitos multialambre por
// encima de lo esperado, envejece el aislamiento más rápido, y un
// desbalance de tensión asociado empuja a deratear motores (NEMA MG-1)
// o directamente a no operarlos con seguridad por encima de 5%.
export const UMBRAL_DESBALANCE_FASES_PCT = 10.0;

export const MIN_COSPHI = 0.5;
export const MAX_COSPHI = 1.0;

export const MIN_TEMP_C = -10;
export const MAX_TEMP_C = 60;
