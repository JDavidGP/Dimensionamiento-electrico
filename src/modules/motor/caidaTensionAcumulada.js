// Chequeo ADICIONAL de caída de tensión ACUMULADA sobre una CADENA de
// tramos (circuito + N alimentadores de tablero, subiendo tableroPadreId
// hasta la acometida). NO reemplaza el chequeo individual de cada tramo
// — eso sigue viviendo en seleccionarSeccion.js, contra
// normativa.limiteCaidaTensionPct (3% por tramo, sin cambios).
//
// MÉTODO (decidido, ver conversación de diseño): se suman VOLTIOS
// (deltaV), no porcentajes — cada tramo de la cadena puede tener una
// tensión nominal de referencia distinta (ej. si algún día hay cambio
// de nivel de tensión en el medio, ver nota de alcance abajo). El %
// final se calcula UNA sola vez, al terminar de sumar, contra la
// tensión nominal del punto de utilización (la carga que se evalúa) —
// nunca sumando porcentajes que ya vienen calculados contra bases
// distintas, que es matemáticamente inválido.
//
// Límite: 5% total — CONFIRMADO con fuente (NEC 210.19(A) Nota
// informativa N.° 4 + 215.2(A)(1) Nota informativa N.° 2, nota
// INFORMATIVA no exigible por artículo, NEC §90.5). Ver el comentario
// completo de LIMITE_CAIDA_TENSION_ACUMULADA_PROVISIONAL_PCT en
// shared/constants/constantes.js — sigue nombrada PROVISIONAL como
// política del proyecto (afinable para media tensión/transformadores),
// no porque la cifra esté sin verificar.
//
// FUERA DE ALCANCE (a propósito, no esta sesión): transformadores,
// cambio de nivel de tensión entre tramos, frecuencias distintas. Esta
// función asume que `tensionReferenciaV` es válida para TODOS los
// tramos que ya se sumaron en voltios — mezclar niveles de tensión sin
// modelar el transformador es responsabilidad de quien arme
// deltaVPorTramo, no de esta función.
//
// Esta función NO sabe de dónde salen los deltaV, ni si algún tramo de
// la cadena falló o está pendiente — eso lo resuelve el llamador
// (TableroMediator.caidaAcumuladaDesdeCircuito) ANTES de invocarla: si
// esta función se llama, es porque todos los tramos son válidos.
import { LIMITE_CAIDA_TENSION_ACUMULADA_PROVISIONAL_PCT } from "../../shared/constants/constantes.js";

/**
 * @param {number[]} deltaVPorTramo - caída en VOLTIOS de cada tramo de
 *   la cadena (circuito + cada alimentador), ya validados por el
 *   llamador. El orden no importa, solo se suman.
 * @param {number} tensionReferenciaV - tensión nominal del punto de
 *   utilización (normalmente circuito.voltaje) — denominador del %
 *   final, se aplica UNA sola vez.
 * @returns {{
 *   aplica: true, deltaVTotal: number, totalPct: number,
 *   limitePct: number, excede: boolean, cantidadTramos: number
 * }}
 */
export function evaluarCaidaAcumulada(deltaVPorTramo, tensionReferenciaV) {
  const deltaVTotal = deltaVPorTramo.reduce((s, v) => s + Number(v), 0);
  const totalPct = (deltaVTotal / Number(tensionReferenciaV)) * 100;

  return {
    aplica: true,
    deltaVTotal,
    totalPct,
    limitePct: LIMITE_CAIDA_TENSION_ACUMULADA_PROVISIONAL_PCT,
    excede: totalPct > LIMITE_CAIDA_TENSION_ACUMULADA_PROVISIONAL_PCT,
    cantidadTramos: deltaVPorTramo.length,
  };
}
