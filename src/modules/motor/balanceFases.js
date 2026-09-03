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
// — a diferencia del 5% de caída de tensión acumulada, este NO tiene
// artículo del NEC que lo fije (es práctica de industria/IEEE, no Code),
// y todavía no está decidido como definitivo. No inventar otro número
// acá — cambiarlo se hace en esa constante, no en este archivo.
import { UMBRAL_DESBALANCE_FASES_PCT } from "../../shared/constants/constantes.js";

/**
 * @param {Object<string, number>} aportesPorLinea - corriente en A ya
 *   sumada por línea, ej. { L1: 24.3, L2: 18.1, L3: 30.0 }. Con menos
 *   de 2 líneas no hay nada que comparar — no es un dato faltante, es
 *   matemáticamente inaplicable (por eso `aplica: false`, no un error).
 * @returns {{aplica: false} | {
 *   aplica: true, porLinea: Object<string, number>,
 *   porcentajeDesbalance: number, limitePct: number, excede: boolean
 * }}
 */
export function balanceFases(aportesPorLinea) {
  const lineas = Object.keys(aportesPorLinea);
  if (lineas.length < 2) {
    return { aplica: false };
  }

  const valores = lineas.map((l) => aportesPorLinea[l]);
  const maximo = Math.max(...valores);
  const minimo = Math.min(...valores);
  const promedio = valores.reduce((s, v) => s + v, 0) / valores.length;
  const porcentajeDesbalance = promedio > 0 ? ((maximo - minimo) / promedio) * 100 : 0;

  return {
    aplica: true,
    porLinea: aportesPorLinea,
    porcentajeDesbalance,
    limitePct: UMBRAL_DESBALANCE_FASES_PCT,
    excede: porcentajeDesbalance > UMBRAL_DESBALANCE_FASES_PCT,
  };
}
