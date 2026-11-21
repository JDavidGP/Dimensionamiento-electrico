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
 * Reparto R/X: con `xr` (ver obtenerXRTransformador, tabla citada por
 * tamaño/refrigeración) se reparte R y X de verdad — necesario en
 * cuanto se suma la impedancia de un conductor aguas abajo (ahí sí
 * importa el reparto, no solo la magnitud). Sin `xr` (parámetro
 * opcional, compatibilidad hacia atrás), se trata TODA la impedancia
 * como reactancia pura (r=0, x=Z) — válido SOLO para cortocircuito EN
 * LOS BORNES (zTotal=√(r²+x²)=Z de cualquier forma que se reparta),
 * inválido en cuanto se suma un conductor en serie sin el reparto real.
 *
 * Monofásico (usuario, 2026-11-21, documento "transformador
 * monofásico", fórmula verificada contra su ejemplo numérico: 50kVA/
 * 240V/uk=4% → Z=0,04608Ω → Icc=5208,33A, y contra IEC 60076-1 §5.4.2
 * "Isc = S_N/(U_r×u_k)"): la fórmula de Z_trafo es la MISMA (Z = %Z/100
 * × V²/S_N, sin diferencia de forma entre mono y tri — cada documento
 * la verifica por separado con su propio ejemplo). Lo que cambia es
 * cómo se pasa de Z a Icc, que decide el LLAMADOR según fases:
 *   - "tri": calcularCortocircuitoTrifasico(V, {r:0,x:Z}, 0, 0) → V/(√3×Z)
 *   - "mono": calcularCortocircuitoMonofasico(V, {r:0,x:Z}, 0, 0) → V/Z
 *     (el "lazo" en los bornes es puramente la impedancia del
 *     transformador — sin conductor que duplicar todavía).
 */
export function calcularImpedanciaTransformadorOhm({
  capacidadKVA,
  tensionSecundariaV,
  impedanciaPct,
  xr,
}: {
  capacidadKVA: number | string;
  tensionSecundariaV: number | string;
  impedanciaPct: number | string;
  /** X/R opcional (ver obtenerXRTransformador) — sin esto, reparto degenerado r=0/x=Z (ver nota de la función). */
  xr?: number | null;
}): ResultadoImpedanciaTransformador {
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
  if (xr != null && xr > 0) {
    // Z = √(R²+X²), X/R = xr  =>  R = Z/√(1+xr²), X = R×xr
    const r = zOhm / Math.sqrt(1 + xr * xr);
    const x = r * xr;
    return { disponible: true, impedancia: { r, x } };
  }
  return { disponible: true, impedancia: { r: 0, x: zOhm } };
}

export type TipoRefrigeracionTransformador = "aceite" | "seco";

/**
 * X/R por tamaño de transformador de DISTRIBUCIÓN (≤1MVA) — usuario,
 * 2026-11-21, documento "tabla completa X/R aceite/seco" (fuente
 * citada: GE/ABB standard design, vía Industrial Monitor Direct).
 * Determina la decadencia del offset DC del cortocircuito (IEEE 141
 * Fig.4A / IEEE 399 Fig.153) — necesario para repartir |Z| (ya
 * conocida del %Z, ver calcularImpedanciaTransformadorOhm) en R y X
 * por separado cuando se SUMA la impedancia de un conductor aguas
 * abajo (en los bornes solos el reparto no cambia el resultado).
 *
 * Discrepancia encontrada entre los 2 documentos del usuario, 750kVA
 * aceite: el documento "tabla de X/R por tamaño de transformador"
 * (el primero) da X/R=6.0; el documento "tabla completa X/R
 * aceite/seco" (el segundo, más explícito en separar ambos tipos) da
 * X/R=5.5. Se usa 5.5 acá — PENDIENTE de que el usuario confirme cuál
 * es la correcta si llega a importar en un proyecto real con un
 * transformador de 750kVA.
 *
 * Fuera de rango (<75 o >1000 kVA): no disponible a propósito — la
 * tabla de transformadores de POTENCIA (>1MVA) del mismo documento da
 * rangos, no valores puntuales, y usa 2 fuentes que no coinciden entre
 * sí (IEEE 141 vs ANSI/IEEE C37.010) — no se aplica acá.
 */
const TABLA_XR_DISTRIBUCION: Record<TipoRefrigeracionTransformador, Array<{ kva: number; xr: number }>> = {
  aceite: [
    { kva: 75, xr: 3.2 },
    { kva: 150, xr: 3.8 },
    { kva: 300, xr: 4.5 },
    { kva: 500, xr: 5.2 },
    { kva: 750, xr: 5.5 },
    { kva: 1000, xr: 6.5 },
  ],
  seco: [
    { kva: 75, xr: 2.8 },
    { kva: 150, xr: 3.2 },
    { kva: 300, xr: 3.8 },
    { kva: 500, xr: 4.3 },
    { kva: 750, xr: 4.8 },
    { kva: 1000, xr: 5.5 },
  ],
};

export type ResultadoXRTransformador = { disponible: false; motivo: string } | { disponible: true; xr: number; interpolado: boolean };

/**
 * X/R para un transformador de distribución dado — valor EXACTO de la
 * tabla si el kVA coincide, interpolación LINEAL entre los 2 puntos
 * citados más cercanos si no (nunca extrapolación fuera del rango
 * citado — eso devuelve `disponible:false`).
 */
export function obtenerXRTransformador({
  capacidadKVA,
  tipoRefrigeracion,
}: {
  capacidadKVA: number | string;
  tipoRefrigeracion: string;
}): ResultadoXRTransformador {
  const kva = Number(capacidadKVA);
  if (!(kva > 0)) {
    return { disponible: false, motivo: "Falta capacidad (kVA) del transformador." };
  }
  if (tipoRefrigeracion !== "aceite" && tipoRefrigeracion !== "seco") {
    return { disponible: false, motivo: "Falta el tipo de refrigeración (aceite/seco) del transformador." };
  }
  const tabla = TABLA_XR_DISTRIBUCION[tipoRefrigeracion];
  if (kva < tabla[0].kva || kva > tabla[tabla.length - 1].kva) {
    return { disponible: false, motivo: `Capacidad fuera del rango de la tabla X/R citada (${tabla[0].kva}-${tabla[tabla.length - 1].kva} kVA).` };
  }
  const exacto = tabla.find((fila) => fila.kva === kva);
  if (exacto) {
    return { disponible: true, xr: exacto.xr, interpolado: false };
  }
  let inferior = tabla[0];
  let superior = tabla[tabla.length - 1];
  for (let i = 0; i < tabla.length - 1; i++) {
    if (kva >= tabla[i].kva && kva <= tabla[i + 1].kva) {
      inferior = tabla[i];
      superior = tabla[i + 1];
      break;
    }
  }
  const fraccion = (kva - inferior.kva) / (superior.kva - inferior.kva);
  return { disponible: true, xr: inferior.xr + fraccion * (superior.xr - inferior.xr), interpolado: true };
}
