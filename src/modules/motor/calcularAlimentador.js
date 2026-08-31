// Dimensionamiento del ALIMENTADOR de un tablero: el tramo troncal que
// lo conecta hacia arriba (acometida u otro tablero). Reusa la misma
// selección de sección/breaker que un circuito derivado — la física es
// idéntica, cambia qué corriente lo atraviesa (la agregada del tablero,
// no la de un equipo).
//
// PROVISIONAL: la corriente agregada viene de combinarResultadosCircuitos
// (suma lineal, sin factor de diversidad de alimentador propio).
import { calcularCorriente } from "./corriente.js";
import { seleccionarSeccion } from "./seleccionSeccion.js";
import { seleccionarBreaker } from "./breaker.js";
import { combinarResultadosCircuitos } from "./combinarResultadosCircuitos.js";

/**
 * @param {object} tablero - { longitudAlimentador, materialAlimentador, tensionAlimentacion }
 * @param {Array} resultadosCircuitos - resultados YA calculados de los circuitos de ese tablero
 * @param {string} fases - "mono" | "bi" | "tri" (el tramo troncal puede ser trifásico aunque los circuitos sean mono)
 * @param {object} normativa - normativa activa ya resuelta
 * @param {number} [temp=30] - temperatura ambiente del tramo troncal
 */
export function calcularAlimentador(tablero, resultadosCircuitos, fases, normativa, temp = 30) {
  if (!normativa || typeof normativa !== "object") {
    return { ok: false, error: "Normativa no inyectada." };
  }

  const { potenciaTotalW, cosPhiCombinado, cantidadCircuitos } = combinarResultadosCircuitos(resultadosCircuitos);

  if (cantidadCircuitos === 0) {
    return { ok: false, pendiente: true, motivo: "Sin circuitos calculados asignados a este tablero todavía." };
  }

  const distanciaM = Number(tablero.longitudAlimentador);
  if (!distanciaM || distanciaM <= 0) {
    return { ok: false, pendiente: true, motivo: "Falta la longitud del alimentador." };
  }

  const material = (tablero.materialAlimentador || "cobre").toLowerCase();
  const tensionV = Number(tablero.tensionAlimentacion);

  const corrienteDiseno = calcularCorriente(potenciaTotalW, tensionV, fases, cosPhiCombinado);

  const seleccion = seleccionarSeccion({
    corrienteA: corrienteDiseno,
    distanciaM,
    cosPhi: cosPhiCombinado,
    material,
    fases,
    temp,
    voltajeV: tensionV,
    normativa,
  });

  if (!seleccion) {
    return {
      ok: false,
      potenciaTotalW,
      cosPhiCombinado,
      corrienteDiseno,
      cantidadCircuitos,
      error: `Ningún calibre de ${material} cumple ampacidad y caída de tensión (≤${normativa.limiteCaidaTensionPct}%) para ${corrienteDiseno.toFixed(
        2
      )}A a ${distanciaM}m bajo ${normativa.nombre}. Es una aproximación provisional (suma lineal, sin diversidad de alimentador).`,
    };
  }

  const { breaker, advertencia } = seleccionarBreaker(corrienteDiseno, seleccion.ampacidadCorregida, normativa.breakersComerciales);

  return {
    ok: true,
    potenciaTotalW,
    cosPhiCombinado,
    corrienteDiseno,
    cantidadCircuitos,
    seccion: seleccion.seccion,
    unidadSeccion: normativa.unidadSeccion,
    areaMm2: seleccion.areaMm2,
    ampacidadCorregida: seleccion.ampacidadCorregida,
    caidaPct: seleccion.caidaPct,
    breaker,
    advertencias: advertencia ? [advertencia] : [],
    notaDimensionamiento:
      "PROVISIONAL: suma lineal de la demanda de los circuitos asignados, sin factor de diversidad de alimentador propio.",
  };
}
