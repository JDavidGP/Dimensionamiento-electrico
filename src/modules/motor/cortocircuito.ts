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
//
// Usuario, 2026-11-21 (documento "protección de transformador",
// fórmula verificada contra su ejemplo numérico: 400kVA/400V/uk=4% →
// Icc=14 434A): PRIMER dato real conectado a `impedanciaFuenteOhm` —
// calcularImpedanciaTransformadorOhm() convierte el %Z de placa del
// transformador a Ω, para usarlo directo en calcularCortocircuitoTrifasico
// (ver más abajo). Esto NO cierra el "ESTADO ACTUAL" de arriba del
// todo — solo cubre el cortocircuito EN LOS BORNES del transformador
// (conductor = 0, sin tramo aguas abajo); seguir la cadena hasta un
// tablero remoto sigue necesitando el nivel Tablero/diagrama que no
// existe todavía.
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

export type ResultadoImpedanciaTransformador = { disponible: false; motivo: string } | { disponible: true; impedancia: ImpedanciaFuente };

/**
 * %Z de placa → impedancia en Ω, para usar como `impedanciaFuenteOhm`
 * de calcularCortocircuitoTrifasico. Fórmula estándar (IEC 60909/IEEE,
 * misma que usa el documento del usuario para su ejemplo numérico):
 *
 *   Z_trafo (Ω) = (%Z / 100) × V²_línea / S_N(VA)
 *
 * Verificado: 400kVA, 400V, %Z=4% → Z=0,016Ω → Icc = 400/(√3×0,016) =
 * 14 434A, exacto contra el ejemplo del documento.
 *
 * Reparto R/X: el documento NO da X/R de placa (dato que normalmente
 * viene de una tabla de fabricante aparte, no de %Z solo) — se trata
 * TODA la impedancia como reactancia pura (r=0, x=Z). Esto no cambia
 * el Icc en los BORNES del transformador (zTotal=√(r²+x²)=Z de
 * cualquier forma que se reparta) — pero si algún día se suma la
 * impedancia de un conductor aguas abajo, un reparto R/X real de placa
 * sí cambiaría el resultado y éste deja de ser válido: no inventar esa
 * repartición sin dato de fabricante.
 *
 * Alcance trifásico únicamente — el documento no cubre el caso
 * monofásico (que necesitaría su propia derivación para el lazo de
 * calcularCortocircuitoMonofasico, no solo la magnitud); un
 * transformador fases:"mono" devuelve `disponible:false` en vez de
 * inventar una fórmula no verificada.
 */
export function calcularImpedanciaTransformadorOhm({
  capacidadKVA,
  tensionSecundariaV,
  impedanciaPct,
  fases,
}: {
  capacidadKVA: number | string;
  tensionSecundariaV: number | string;
  impedanciaPct: number | string;
  fases: "mono" | "tri";
}): ResultadoImpedanciaTransformador {
  if (fases !== "tri") {
    return { disponible: false, motivo: "Cortocircuito por %Z solo verificado para transformador trifásico (ver nota de la función)." };
  }
  const kva = Number(capacidadKVA);
  const v = Number(tensionSecundariaV);
  const z = Number(impedanciaPct);
  if (!(kva > 0) || !(v > 0)) {
    return { disponible: false, motivo: "Falta capacidad (kVA) y/o tensión secundaria del transformador." };
  }
  if (!(z > 0)) {
    return { disponible: false, motivo: "Falta el %Z de placa del transformador." };
  }
  const zOhm = (z / 100) * (v * v) / (kva * 1000);
  return { disponible: true, impedancia: { r: 0, x: zOhm } };
}
