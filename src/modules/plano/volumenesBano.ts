// src/modules/plano/volumenesBano.ts
//
// REBT ITC-BT-27 §2.1 + Tabla 1 — cita LITERAL (BOE-A-2002-18099,
// texto consolidado del REBT, no un resumen): usuario, 2026-11-26,
// "sigamos" tras pedirme confirmar yo mismo la Tabla 1 exacta antes de
// fijar un número.
//
// §2.1.3 Volumen 2: "El plano vertical exterior al volumen 1 y el
// plano vertical paralelo situado a una distancia de 0,6 m".
// §2.1.4 Volumen 3: "El plano vertical límite exterior del volumen 2
// y el plano vertical paralelo situado a una distancia de éste de 2,4 m".
// §2.1.2 Volumen 1 (ducha sin plato, rociador fijo): "delimitado por
// la superficie generatriz vertical situada a un radio de 0,6 m
// alrededor del rociador" (o 1,2 m si el difusor puede desplazarse).
// Tabla 1, columna "Mecanismos": Volumen 0/1/2, tomas de corriente
// ("bases") → "No permitida" (hay excepciones MBTS/afeitadoras en el
// texto real, no modeladas acá — ver SIMPLIFICACIÓN). Volumen 3 →
// "Se permiten las bases sólo si están protegidas... por un
// dispositivo de protección por corriente diferencial de valor no
// superior a los 30 mA".
//
// SIMPLIFICACIÓN DELIBERADA (mismo criterio que GFCI/AFCI): el Plano
// es 2D — la norma real también acota cada volumen por ALTURA (2,25m,
// o hasta el techo/3m) y el Volumen 1 por la propia huella 3D de la
// bañera/ducha. Acá se mide solo la distancia HORIZONTAL desde un
// marcador "Fuente de agua", con un radio de Volumen 1 editable por
// marcador (default 0,6m — el único número exacto que da la norma
// para el caso típico, ducha con rociador fijo; el instalador lo
// ajusta para una bañera más grande o un difusor móvil con el 1,2m
// también citado). Omitir la altura real casi nunca cambia el
// resultado — un tomacorriente residencial normal siempre queda bien
// por debajo del límite de 2,25m de todas formas. Las excepciones MBTS
// / bloques de afeitadoras de la Tabla 1 tampoco se modelan — son
// casos especiales, no el tomacorriente estándar que esto evalúa.

import type { Punto } from "../geometria/tipos.ts";
import { distancia } from "../geometria/index.ts";

/** ITC-BT-27 §2.1.3 — ancho del Volumen 2 (anillo más allá del Volumen 1). */
export const ANCHO_VOLUMEN_2_M = 0.6;
/** ITC-BT-27 §2.1.4 — ancho del Volumen 3 (anillo más allá del Volumen 2). */
export const ANCHO_VOLUMEN_3_M = 2.4;
/** ITC-BT-27 §2.1.2 — radio del Volumen 1 para el caso típico (ducha con rociador fijo); editable por marcador. */
export const RADIO_VOLUMEN1_DEFECTO_M = 0.6;
/** Tabla 1, Volumen 3 — sensibilidad máxima del diferencial que protege una base ahí. */
export const SENSIBILIDAD_MAXIMA_VOLUMEN3_MA = 30;

export type ZonaBano = "prohibido" | "volumen_3" | "fuera";

export interface ResultadoZonaBano {
  zona: ZonaBano;
  distanciaM: number;
  /** Cita de sección — "" cuando zona es "fuera" (nada que citar). */
  motivo: string;
}

/**
 * Clasifica una distancia horizontal (ya medida) a una fuente de agua
 * contra los anchos de Volumen 2/3 de ITC-BT-27 — pura aritmética, sin
 * geometría propia (eso lo hace fuenteAguaMasCercana/evaluarZonaBano
 * más abajo).
 */
export function clasificarDistanciaBano(distanciaM: number, radioVolumen1M: number = RADIO_VOLUMEN1_DEFECTO_M): ResultadoZonaBano {
  const limiteProhibido = radioVolumen1M + ANCHO_VOLUMEN_2_M;
  const limiteVolumen3 = limiteProhibido + ANCHO_VOLUMEN_3_M;
  if (distanciaM <= limiteProhibido) {
    return { zona: "prohibido", distanciaM, motivo: 'ITC-BT-27 Tabla 1 — tomas de corriente "No permitida" en Volúmenes 0/1/2' };
  }
  if (distanciaM <= limiteVolumen3) {
    return { zona: "volumen_3", distanciaM, motivo: "ITC-BT-27 Tabla 1, Volumen 3 — exige diferencial ≤30mA" };
  }
  return { zona: "fuera", distanciaM, motivo: "" };
}

/** Forma mínima de un marcador "fuente_agua" que esta pieza necesita leer. */
export interface MarcadorFuenteAgua {
  punto: Punto;
  tipo: string;
  radioVolumen1M?: number | string | null;
}

/** La fuente de agua MÁS CERCANA a `punto` (sin límite de radio — a diferencia de nodoCercano, acá SIEMPRE hace falta la más próxima, esté a la distancia que esté, para saber en qué volumen cae). null si no hay ninguna en el plano. */
export function fuenteAguaMasCercana<M extends MarcadorFuenteAgua>(punto: Punto, marcadores: M[] = []): { marcador: M; distanciaM: number } | null {
  let mejor: M | null = null;
  let menorDistancia = Infinity;
  for (const m of marcadores) {
    if (m.tipo !== "fuente_agua") continue;
    const d = distancia(punto, m.punto);
    if (d < menorDistancia) {
      menorDistancia = d;
      mejor = m;
    }
  }
  return mejor ? { marcador: mejor, distanciaM: menorDistancia } : null;
}

/** Punto de entrada único: ¿en qué zona de ITC-BT-27 cae `punto` (el de un tomacorriente), según la fuente de agua más cercana del plano? null = no hay ninguna fuente de agua marcada todavía, nada que evaluar. */
export function evaluarZonaBano<M extends MarcadorFuenteAgua>(punto: Punto, marcadores: M[] = []): ResultadoZonaBano | null {
  const cercana = fuenteAguaMasCercana(punto, marcadores);
  if (!cercana) return null;
  const radioVolumen1M =
    cercana.marcador.radioVolumen1M === "" || cercana.marcador.radioVolumen1M == null ? RADIO_VOLUMEN1_DEFECTO_M : Number(cercana.marcador.radioVolumen1M);
  return clasificarDistanciaBano(cercana.distanciaM, radioVolumen1M);
}
