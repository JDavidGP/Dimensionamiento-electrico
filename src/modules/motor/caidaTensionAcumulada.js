// Chequeo ADICIONAL de caída de tensión ACUMULADA (alimentador + circuito
// derivado). NO reemplaza el chequeo individual de cada tramo — eso sigue
// viviendo en seleccionarSeccion.js, contra normativa.limiteCaidaTensionPct
// (3% por tramo, sin cambios). Esta función solo suma dos porcentajes YA
// calculados por otros módulos y compara contra el límite combinado.
//
// PROVISIONAL (ver LIMITE_CAIDA_TENSION_ACUMULADA_PROVISIONAL_PCT en
// shared/constants/constantes.js): 5% total, nota informativa de NEC
// 210.19(A) (3% circuito + 3% alimentador). Hoy solo suma UN tramo de
// alimentador (tablero → acometida); cuando se encadene tableroPadreId
// (varios tableros en serie) este chequeo va a necesitar sumar cada tramo
// intermedio, no solo dos — eso es trabajo de la sesión de subtableros,
// no de este módulo.
import { LIMITE_CAIDA_TENSION_ACUMULADA_PROVISIONAL_PCT } from "../../shared/constants/constantes.js";

/**
 * @param {number} caidaCircuitoPct - % de caída del circuito derivado (ya calculado).
 * @param {number|null|undefined} caidaAlimentadorPct - % de caída del
 *   alimentador del tablero al que pertenece el circuito. Pasar
 *   null/undefined cuando no hay dato (circuito sin tablero, o tablero sin
 *   alimentador calculado todavía) — NUNCA se asume 0 acá: el llamador
 *   recibe `aplica: false` y no debe mostrar ni inventar un resultado.
 * @returns {{aplica: false} | {aplica: true, totalPct: number, limitePct: number, excede: boolean}}
 */
export function evaluarCaidaAcumulada(caidaCircuitoPct, caidaAlimentadorPct) {
  if (caidaAlimentadorPct == null || !Number.isFinite(Number(caidaAlimentadorPct))) {
    return { aplica: false };
  }

  const totalPct = Number(caidaCircuitoPct) + Number(caidaAlimentadorPct);

  return {
    aplica: true,
    totalPct,
    limitePct: LIMITE_CAIDA_TENSION_ACUMULADA_PROVISIONAL_PCT,
    excede: totalPct > LIMITE_CAIDA_TENSION_ACUMULADA_PROVISIONAL_PCT,
  };
}
