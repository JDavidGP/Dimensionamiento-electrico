// src/modules/motor/cortocircuito.ts
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
import type { ImpedanciaFuente } from "./tipos.ts";

export interface ResultadoCortocircuitoTrifasico {
  iccA: number;
  zTotalOhm: number;
  rTotalOhm: number;
  xTotalOhm: number;
}

/**
 * Cortocircuito trifásico simétrico (falla franca, "bolted fault").
 * Icc = (c × Vlínea) / (√3 × |Z_total|)
 *
 * @param tensionLineaV - tensión línea-línea, V
 * @param impedanciaFuenteOhm - {r, x} de la fuente aguas arriba (Ω, por fase)
 * @param resistenciaConductorOhm - resistencia del conductor hasta el punto de falla (Ω)
 * @param reactanciaConductorOhm - reactancia del conductor hasta el punto de falla (Ω)
 * @param factorC - factor de tensión (IEC 60909 usa c≈1.0 caso máximo, c≈0.95 caso mínimo)
 */
export function calcularCortocircuitoTrifasico(
  tensionLineaV: number,
  impedanciaFuenteOhm: ImpedanciaFuente | null | undefined,
  resistenciaConductorOhm: number,
  reactanciaConductorOhm: number,
  factorC: number = 1.0
): ResultadoCortocircuitoTrifasico {
  const rTotalOhm = (impedanciaFuenteOhm?.r ?? 0) + resistenciaConductorOhm;
  const xTotalOhm = (impedanciaFuenteOhm?.x ?? 0) + reactanciaConductorOhm;
  const zTotalOhm = Math.sqrt(rTotalOhm ** 2 + xTotalOhm ** 2);

  if (zTotalOhm === 0) {
    return { iccA: Infinity, zTotalOhm: 0, rTotalOhm, xTotalOhm };
  }

  const iccA = (factorC * tensionLineaV) / (Math.sqrt(3) * zTotalOhm);
  return { iccA, zTotalOhm, rTotalOhm, xTotalOhm };
}

export interface ResultadoCortocircuitoMonofasico {
  iccA: number;
  zLazoOhm: number;
  rLazoOhm: number;
  xLazoOhm: number;
}

/**
 * Cortocircuito monofásico línea-neutro. El lazo de falla incluye IDA y
 * VUELTA (línea + neutro), por eso el conductor se cuenta ×2 — a
 * diferencia del trifásico, donde el "retorno" va por las otras fases y
 * ya está representado en la impedancia de fuente por fase.
 *
 * Icc = (c × Vfase) / |Z_lazo|
 *
 * @param tensionFaseV - tensión línea-neutro, V
 * @param impedanciaFuenteLazoOhm - impedancia de lazo de la fuente (Ω)
 * @param resistenciaConductorOhm - resistencia de UN conductor (Ω), se duplica internamente
 * @param reactanciaConductorOhm - reactancia de UN conductor (Ω), se duplica internamente
 */
export function calcularCortocircuitoMonofasico(
  tensionFaseV: number,
  impedanciaFuenteLazoOhm: ImpedanciaFuente | null | undefined,
  resistenciaConductorOhm: number,
  reactanciaConductorOhm: number,
  factorC: number = 1.0
): ResultadoCortocircuitoMonofasico {
  const rLazoOhm = (impedanciaFuenteLazoOhm?.r ?? 0) + 2 * resistenciaConductorOhm;
  const xLazoOhm = (impedanciaFuenteLazoOhm?.x ?? 0) + 2 * reactanciaConductorOhm;
  const zLazoOhm = Math.sqrt(rLazoOhm ** 2 + xLazoOhm ** 2);

  if (zLazoOhm === 0) {
    return { iccA: Infinity, zLazoOhm: 0, rLazoOhm, xLazoOhm };
  }

  const iccA = (factorC * tensionFaseV) / zLazoOhm;
  return { iccA, zLazoOhm, rLazoOhm, xLazoOhm };
}

export interface ResultadoCapacidadInterrupcion {
  cumple: boolean;
  iccA: number;
  capacidadA: number;
  margen: number;
}

/**
 * Compara la Icc calculada contra la capacidad de interrupción (kA) de
 * un breaker específico del proyecto (dato de equipo, no de normativa).
 *
 * @param capacidadInterrupcionKA - dato del breaker seleccionado en el proyecto
 */
export function verificarCapacidadInterrupcion(iccA: number, capacidadInterrupcionKA: number): ResultadoCapacidadInterrupcion {
  const capacidadA = capacidadInterrupcionKA * 1000;
  return {
    cumple: iccA <= capacidadA,
    iccA,
    capacidadA,
    margen: capacidadA - iccA,
  };
}
