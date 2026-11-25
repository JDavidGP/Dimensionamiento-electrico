// src/modules/motor/canalizacionREBT.ts
//
// Diámetro mínimo de tubo por ITC-BT-21 (REBT) — ver la nota larga en
// shared/data/canalizacionREBT.js para la fuente y el porqué de NO
// calcular el caso de >5 (superficial/empotrada/al aire) o >10
// (enterrado) conductores (depende de un diámetro interior que el
// fabricante declara, no la norma). Geométrico puro, igual criterio
// que canalizacion.ts: no sabe de Tablero/topología. Dos funciones: la
// de superficial/empotrada/al aire (Tabla 2/5/7, misma estructura —
// un array de 5 diámetros por sección, 1 función sirve para las 3) y,
// más abajo, la de enterrado (Tabla 9, estructura DISTINTA — 2 bandas,
// no 5 columnas — por eso es una función separada, no un 4to valor de
// tipoInstalacion acá).
import {
  TABLA_DIAMETRO_TUBO_REBT,
  MULTIPLICADOR_SECCION_INTERIOR_MINIMO,
  TIPOS_INSTALACION_TUBO_REBT,
  TABLA_DIAMETRO_TUBO_ENTERRADO_REBT,
} from "../../shared/data/canalizacionREBT.js";

export { TIPOS_INSTALACION_TUBO_REBT };

export type TipoInstalacionTuboREBT = "superficial" | "empotrada" | "al_aire";

/** Tabla de ITC-BT-21 que da cada tipo de instalación — solo para el mensaje de error, no afecta el cálculo. */
const NUMERO_TABLA_POR_TIPO: Record<TipoInstalacionTuboREBT, string> = {
  superficial: "2",
  empotrada: "5",
  al_aire: "7",
};

export type ResultadoDiametroTuboREBT =
  | { disponible: true; diametroExteriorMm: number }
  | { disponible: false; motivo: string };

/**
 * @param seccionMm2 - sección nominal del conductor unipolar (mm²), ej. "2.5" o 2.5 — debe ser una de las filas de la Tabla 2/5/7 (la de "al_aire" solo llega a 16mm², ver su nota en shared/data).
 * @param numeroConductores - cantidad de conductores de ESA MISMA sección en el mismo tubo (entero, 1 a 5).
 * @param tipoInstalacion - "superficial" (Tabla 2), "empotrada" (Tabla 5) o "al_aire" (Tabla 7 — SOLO el tramo de tubo flexible a una máquina, NO tubo rígido sobre estructura/falso techo, eso es "superficial") — dan diámetros distintos, no intercambiables.
 */
export function diametroMinimoTuboREBT(
  seccionMm2: number | string,
  numeroConductores: number,
  tipoInstalacion: TipoInstalacionTuboREBT
): ResultadoDiametroTuboREBT {
  const tabla = TABLA_DIAMETRO_TUBO_REBT[tipoInstalacion];
  if (!tabla) {
    return { disponible: false, motivo: `Tipo de instalación de tubo "${tipoInstalacion}" no reconocido (usar "superficial", "empotrada" o "al_aire").` };
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
    return { disponible: false, motivo: `Sección ${seccionMm2} mm² no está en la Tabla ${NUMERO_TABLA_POR_TIPO[tipoInstalacion]} de ITC-BT-21.` };
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

/**
 * Diámetro mínimo de tubo ENTERRADO — ITC-BT-21 Tabla 9. Estructura
 * distinta a Tabla 2/5 (ver nota en shared/data/canalizacionREBT.js):
 * solo 2 bandas (≤6 conductores / 7-10), tabulada hasta 10 (no 5). Para
 * >10 conductores o secciones mixtas, la norma no da tabla — exige
 * sección interior ≥4× la ocupada, con diámetro interior declarado por
 * el fabricante (mismo criterio que diametroMinimoTuboREBT arriba).
 *
 * @param seccionMm2 - sección nominal del conductor unipolar (mm²) — debe ser una de las filas de la Tabla 9.
 * @param numeroConductores - cantidad de conductores de ESA MISMA sección en el mismo tubo (entero, 1 a 10).
 */
export function diametroMinimoTuboEnterradoREBT(seccionMm2: number | string, numeroConductores: number): ResultadoDiametroTuboREBT {
  if (!Number.isInteger(numeroConductores) || numeroConductores < 1) {
    return { disponible: false, motivo: `Número de conductores inválido (${numeroConductores}) — debe ser un entero ≥ 1.` };
  }

  if (numeroConductores > 10) {
    return {
      disponible: false,
      motivo:
        "ITC-BT-21 Tabla 9 no tabula más de 10 conductores por tubo enterrado — exige que la sección interior sea como mínimo 4 veces la sección ocupada por los conductores (pto. 1.2.4), pero el diámetro interior de cada tubo comercial lo declara el fabricante (no está en la norma). Verificar con la hoja de datos del tubo elegido.",
    };
  }

  const clave = String(seccionMm2);
  const fila = (TABLA_DIAMETRO_TUBO_ENTERRADO_REBT as Record<string, { hasta6: number; de7a10: number }>)[clave];
  if (!fila) {
    return { disponible: false, motivo: `Sección ${seccionMm2} mm² no está en la Tabla 9 de ITC-BT-21.` };
  }

  return { disponible: true, diametroExteriorMm: numeroConductores <= 6 ? fila.hasta6 : fila.de7a10 };
}
