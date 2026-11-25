// src/modules/motor/instalacionEnterradaREBT.ts
//
// Instalación enterrada REBT — ITC-BT-07/19, ver la nota larga en
// shared/data/canalizacionREBT.js para la fuente. Geométrico/normativo
// puro, igual criterio que canalizacionREBT.ts: no sabe de Tablero/
// topología, solo recibe los datos ya elegidos por quien llama.
import {
  PROFUNDIDAD_MINIMA_ENTERRADA_REBT_M,
  SEPARACION_MINIMA_OTRAS_CANALIZACIONES_REBT_M,
  TABLA_FACTOR_AGRUPACION_TUBOS_REBT,
} from "../../shared/data/canalizacionREBT.js";

export type UbicacionEnterradaREBT = "acera" | "calzada";
export type SeparacionTubosREBT = "contacto" | "0.25" | "0.50" | "1.00_o_mas";

export function profundidadMinimaEnterradaREBT(ubicacion: UbicacionEnterradaREBT): number | null {
  return (PROFUNDIDAD_MINIMA_ENTERRADA_REBT_M as Record<string, number>)[ubicacion] ?? null;
}

export function separacionMinimaOtrasCanalizacionesREBT(gasAltaPresion: boolean = false): number {
  return gasAltaPresion ? SEPARACION_MINIMA_OTRAS_CANALIZACIONES_REBT_M.gas_alta_presion : SEPARACION_MINIMA_OTRAS_CANALIZACIONES_REBT_M.general;
}

/**
 * Factor de agrupación de tubos enterrados — ITC-BT-19 Tabla B.
 * `cantidadCables` que no sea una fila exacta de la tabla se redondea
 * HACIA ARRIBA a la fila siguiente disponible (lado conservador: más
 * cables = más factor de reducción, nunca se subestima el agrupamiento).
 * `separacion` ya viene bucketizada por quien llama (ver
 * separacionABucket) — acá solo se busca la columna.
 */
export function factorAgrupacionTubosREBT(cantidadCables: number, separacion: SeparacionTubosREBT): number | null {
  if (!Number.isInteger(cantidadCables) || cantidadCables < 2) return null;
  if (separacion === "1.00_o_mas") return 1.0;

  const fila = TABLA_FACTOR_AGRUPACION_TUBOS_REBT.find((f) => cantidadCables <= f.cables);
  if (!fila) return null; // más cables de los que tabula la norma (>20) — no se extrapola

  const columna = separacion === "contacto" ? "contacto" : separacion === "0.25" ? "m025" : "m050";
  return fila[columna];
}

/**
 * Bucketiza una separación real medida (en metros) a la columna más
 * cercana de la Tabla B, redondeando hacia ABAJO (lado conservador: se
 * asume menos separación de la real si cae entre dos columnas, nunca
 * más — eso sobrestimaría el factor).
 */
export function separacionABucket(separacionM: number): SeparacionTubosREBT {
  if (separacionM >= 1) return "1.00_o_mas";
  if (separacionM >= 0.5) return "0.50";
  if (separacionM >= 0.25) return "0.25";
  return "contacto";
}
