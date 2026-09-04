// Balance de fases — % de desbalance de CORRIENTE entre las líneas
// (L1/L2/L3) de un tablero. Fórmula estándar de desbalance (misma que
// usa NEMA/ANSI C84.1 para tensión, aplicada acá a corriente):
//   % desbalance = (máximo - mínimo) / promedio × 100
//
// Por qué CORRIENTE y no potencia: un circuito bifásico (2 líneas, ej.
// 240V) NO reparte su corriente entre sus dos líneas — la MISMA
// corriente atraviesa ambas simultáneamente (es un solo lazo). Por eso
// cada línea de un circuito recibe su corrienteDiseno COMPLETA, no una
// fracción — eso lo resuelve el llamador (TableroMediator), esta
// función solo hace la aritmética final sobre los aportes YA sumados.
//
// UMBRAL: ver UMBRAL_DESBALANCE_FASES_PCT en shared/constants/constantes.js
// para la fuente completa (IEEE Std 141 / NEMA MG-1, no un artículo del
// NEC). CONFIRMADO como default del proyecto (10%), y MODIFICABLE — el
// llamador puede pasar un `umbralPct` distinto (típicamente leído de
// Config.limites.desbalanceFasesPct). Si ese umbral supera el
// recomendado, esta función agrega una advertencia SERIA explicando el
// riesgo real, no lo permite en silencio.
import { UMBRAL_DESBALANCE_FASES_PCT } from "../../shared/constants/constantes.js";

/**
 * @param {Object<string, number>} aportesPorLinea - corriente en A ya
 *   sumada por línea, ej. { L1: 24.3, L2: 18.1, L3: 30.0 }. Con menos
 *   de 2 líneas no hay nada que comparar — no es un dato faltante, es
 *   matemáticamente inaplicable (por eso `aplica: false`, no un error).
 * @param {number} [umbralPct] - umbral efectivo a usar para `excede`.
 *   Por defecto, el recomendado (UMBRAL_DESBALANCE_FASES_PCT, 10%). Si
 *   se pasa uno mayor, se agrega una advertencia seria — no cambia el
 *   cálculo del % en sí, solo contra qué se compara y qué se avisa.
 * @returns {{aplica: false} | {
 *   aplica: true, porLinea: Object<string, number>,
 *   porcentajeDesbalance: number, limitePct: number, excede: boolean,
 *   advertencias: string[]
 * }}
 */
export function balanceFases(aportesPorLinea, umbralPct = UMBRAL_DESBALANCE_FASES_PCT) {
  const lineas = Object.keys(aportesPorLinea);
  if (lineas.length < 2) {
    return { aplica: false };
  }

  const valores = lineas.map((l) => aportesPorLinea[l]);
  const maximo = Math.max(...valores);
  const minimo = Math.min(...valores);
  const promedio = valores.reduce((s, v) => s + v, 0) / valores.length;
  const porcentajeDesbalance = promedio > 0 ? ((maximo - minimo) / promedio) * 100 : 0;

  const advertencias = [];
  if (umbralPct > UMBRAL_DESBALANCE_FASES_PCT) {
    advertencias.push(
      `⚠ Umbral de desbalance configurado en ${umbralPct}%, por encima del ${UMBRAL_DESBALANCE_FASES_PCT}% recomendado. ` +
        `Subir este margen no es gratis: un desbalance de corriente sostenido más alto calienta el conductor NEUTRO en ` +
        `circuitos multialambre por encima de lo esperado (puede superar la temperatura de las líneas), acelera el ` +
        `envejecimiento del aislamiento, y — según NEMA MG-1 — un desbalance de TENSIÓN asociado de apenas 5% ya obliga ` +
        `a deratear un motor trifásico a ~75% de su capacidad nominal; operar por encima de ese punto no se recomienda y ` +
        `puede dañar el motor. Usá un margen mayor solo si entendés y aceptás ese riesgo para este proyecto puntual.`
    );
  }

  return {
    aplica: true,
    porLinea: aportesPorLinea,
    porcentajeDesbalance,
    limitePct: umbralPct,
    excede: porcentajeDesbalance > umbralPct,
    advertencias,
  };
}
