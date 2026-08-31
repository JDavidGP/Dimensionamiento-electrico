// src/calculations/cortocircuito.js
//
// Corriente de cortocircuito (Icc) — física pura, NO depende de ninguna
// normativa (ver checklist). Método simplificado análogo a IEC 60909:
// se modela la impedancia total como la suma de la impedancia de la
// fuente (aguas arriba) más la del conductor del circuito bajo análisis.
//
// ⚠ ESTADO ACTUAL: `impedanciaFuenteOhm` es un parámetro de entrada, hoy
// sin dato real conectado (no existe todavía el nivel Tablero/diagrama
// que lo calcule desde transformador+acometida). Mientras tanto, quien
// llame a esta función debe pasar la impedancia de fuente explícitamente
// (0 da un resultado "peor caso" ficticio, útil solo para pruebas, NO
// para dimensionar nada real). La fórmula en sí ya está completa y no
// necesita cambios cuando el diagrama exista — solo empezará a recibir
// un valor real en lugar de 0/estimado.
//
// El resultado (Icc) se compara, en el modelaje del proyecto, contra la
// capacidad de interrupción (kA) del breaker específico seleccionado —
// ese dato vive en el equipo/breaker del proyecto, no acá ni en la
// normativa (ver conversación de diseño).

/**
 * Cortocircuito trifásico simétrico (falla franca, "bolted fault").
 * Icc = (c × Vlínea) / (√3 × |Z_total|)
 *
 * @param {number} tensionLineaV - tensión línea-línea, V
 * @param {number} impedanciaFuenteOhm - {r, x} de la fuente aguas arriba (Ω, por fase)
 * @param {number} resistenciaConductorOhm - resistencia del conductor hasta el punto de falla (Ω)
 * @param {number} reactanciaConductorOhm - reactancia del conductor hasta el punto de falla (Ω)
 * @param {number} [factorC=1.0] - factor de tensión (IEC 60909 usa c≈1.0 caso máximo, c≈0.95 caso mínimo)
 * @returns {{ iccA: number, zTotalOhm: number, rTotalOhm: number, xTotalOhm: number }}
 */
export function calcularCortocircuitoTrifasico(
  tensionLineaV,
  impedanciaFuenteOhm,
  resistenciaConductorOhm,
  reactanciaConductorOhm,
  factorC = 1.0
) {
  const rTotalOhm = (impedanciaFuenteOhm?.r ?? 0) + resistenciaConductorOhm;
  const xTotalOhm = (impedanciaFuenteOhm?.x ?? 0) + reactanciaConductorOhm;
  const zTotalOhm = Math.sqrt(rTotalOhm ** 2 + xTotalOhm ** 2);

  if (zTotalOhm === 0) {
    return { iccA: Infinity, zTotalOhm: 0, rTotalOhm, xTotalOhm };
  }

  const iccA = (factorC * tensionLineaV) / (Math.sqrt(3) * zTotalOhm);
  return { iccA, zTotalOhm, rTotalOhm, xTotalOhm };
}

/**
 * Cortocircuito monofásico línea-neutro. El lazo de falla incluye IDA y
 * VUELTA (línea + neutro), por eso el conductor se cuenta ×2 — a
 * diferencia del trifásico, donde el "retorno" va por las otras fases y
 * ya está representado en la impedancia de fuente por fase.
 *
 * Icc = (c × Vfase) / |Z_lazo|
 *
 * @param {number} tensionFaseV - tensión línea-neutro, V
 * @param {{r: number, x: number}} impedanciaFuenteLazoOhm - impedancia de lazo de la fuente (Ω)
 * @param {number} resistenciaConductorOhm - resistencia de UN conductor (Ω), se duplica internamente
 * @param {number} reactanciaConductorOhm - reactancia de UN conductor (Ω), se duplica internamente
 * @param {number} [factorC=1.0]
 * @returns {{ iccA: number, zLazoOhm: number, rLazoOhm: number, xLazoOhm: number }}
 */
export function calcularCortocircuitoMonofasico(
  tensionFaseV,
  impedanciaFuenteLazoOhm,
  resistenciaConductorOhm,
  reactanciaConductorOhm,
  factorC = 1.0
) {
  const rLazoOhm = (impedanciaFuenteLazoOhm?.r ?? 0) + 2 * resistenciaConductorOhm;
  const xLazoOhm = (impedanciaFuenteLazoOhm?.x ?? 0) + 2 * reactanciaConductorOhm;
  const zLazoOhm = Math.sqrt(rLazoOhm ** 2 + xLazoOhm ** 2);

  if (zLazoOhm === 0) {
    return { iccA: Infinity, zLazoOhm: 0, rLazoOhm, xLazoOhm };
  }

  const iccA = (factorC * tensionFaseV) / zLazoOhm;
  return { iccA, zLazoOhm, rLazoOhm, xLazoOhm };
}

/**
 * Compara la Icc calculada contra la capacidad de interrupción (kA) de
 * un breaker específico del proyecto (dato de equipo, no de normativa).
 *
 * @param {number} iccA
 * @param {number} capacidadInterrupcionKA - dato del breaker seleccionado en el proyecto
 * @returns {{ cumple: boolean, iccA: number, capacidadA: number, margen: number }}
 */
export function verificarCapacidadInterrupcion(iccA, capacidadInterrupcionKA) {
  const capacidadA = capacidadInterrupcionKA * 1000;
  return {
    cumple: iccA <= capacidadA,
    iccA,
    capacidadA,
    margen: capacidadA - iccA,
  };
}
