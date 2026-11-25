// src/modules/motor/canalizacionREBT.ts
//
// Diámetro mínimo de tubo por ITC-BT-21 (REBT) — ver la nota larga en
// shared/data/canalizacionREBT.js para la fuente y el porqué de NO
// calcular el caso de >5 conductores (depende de un diámetro interior
// que el fabricante declara, no la norma). Geométrico puro, igual
// criterio que canalizacion.ts: no sabe de Tablero/topología.
import { TABLA_DIAMETRO_TUBO_REBT, MULTIPLICADOR_SECCION_INTERIOR_MINIMO, TIPOS_INSTALACION_TUBO_REBT } from "../../shared/data/canalizacionREBT.js";

export { TIPOS_INSTALACION_TUBO_REBT };

export type TipoInstalacionTuboREBT = "superficial" | "empotrada";

export type ResultadoDiametroTuboREBT =
  | { disponible: true; diametroExteriorMm: number }
  | { disponible: false; motivo: string };

/**
 * @param seccionMm2 - sección nominal del conductor unipolar (mm²), ej. "2.5" o 2.5 — debe ser una de las filas de la Tabla 2/5.
 * @param numeroConductores - cantidad de conductores de ESA MISMA sección en el mismo tubo (entero, 1 a 5).
 * @param tipoInstalacion - "superficial" (Tabla 2) o "empotrada" (Tabla 5) — dan diámetros distintos, no intercambiables.
 */
export function diametroMinimoTuboREBT(
  seccionMm2: number | string,
  numeroConductores: number,
  tipoInstalacion: TipoInstalacionTuboREBT
): ResultadoDiametroTuboREBT {
  const tabla = TABLA_DIAMETRO_TUBO_REBT[tipoInstalacion];
  if (!tabla) {
    return { disponible: false, motivo: `Tipo de instalación de tubo "${tipoInstalacion}" no reconocido (usar "superficial" o "empotrada").` };
  }

  if (!Number.isInteger(numeroConductores) || numeroConductores < 1) {
    return { disponible: false, motivo: `Número de conductores inválido (${numeroConductores}) — debe ser un entero ≥ 1.` };
  }

  if (numeroConductores > 5) {
    const multiplicador = MULTIPLICADOR_SECCION_INTERIOR_MINIMO[tipoInstalacion];
    return {
      disponible: false,
      motivo: `ITC-BT-21 no tabula más de 5 conductores por tubo — exige que la sección interior sea como mínimo ${multiplicador} veces la sección ocupada por los conductores, pero el diámetro interior de cada tubo comercial lo declara el fabricante (no está en la norma). Verificar con la hoja de datos del tubo elegido.`,
    };
  }

  const clave = String(seccionMm2);
  const fila = (tabla as Record<string, Array<number | null>>)[clave];
  if (!fila) {
    return { disponible: false, motivo: `Sección ${seccionMm2} mm² no está en la Tabla ${tipoInstalacion === "superficial" ? "2" : "5"} de ITC-BT-21.` };
  }

  const diametroExteriorMm = fila[numeroConductores - 1];
  if (diametroExteriorMm == null) {
    return {
      disponible: false,
      motivo: `ITC-BT-21 no da un diámetro para ${numeroConductores} conductores de ${seccionMm2} mm² en instalación ${tipoInstalacion} (celda "--" en la tabla oficial) — usar menos conductores por tubo o separarlos en 2 tubos.`,
    };
  }

  return { disponible: true, diametroExteriorMm };
}
