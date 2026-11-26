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
// ALTURA real (usuario, 2026-11-26, "citar normativas para las
// distancias de instalación" — cerrando la simplificación 2D que
// dejaba este archivo desde su primera ronda). Cita LITERAL, extraída
// del texto consolidado oficial (BOE-A-2002-18099-consolidado.pdf),
// §2.1.2/§2.1.3/§2.1.4:
//   Volumen 1, límite superior (§2.1.2.a): "El plano horizontal
//   superior al volumen 0 y el plano horizontal situado a 2,25 m por
//   encima del suelo".
//   Volumen 2 (§2.1.3.b + párrafo siguiente): "El suelo y plano
//   horizontal situado a 2,25 m por encima del suelo. Además, cuando
//   la altura del techo exceda los 2,25 m por encima del suelo, el
//   espacio comprendido entre el volumen 1 y el techo o hasta una
//   altura de 3 m por encima del suelo, cualquiera que sea el valor
//   menor, se considera volumen 2."
//   Volumen 3 (§2.1.4.b + párrafo siguiente): MISMA estructura exacta,
//   solo que "entre el volumen 2 y el techo" en vez de "el volumen 1".
// En los 2 casos el límite de altura combinado (base + extensión de
// techo) es el MISMO número: min(altura de techo, 3m) — si el techo
// mide 2,25m o menos, el límite es la altura real del techo (no hay
// "extra" que agregar, la norma ya topa en 3m); si el techo es más
// alto, el límite es 3m exactos, nunca la altura real completa del
// techo. `limiteAlturaM` abajo implementa EXACTAMENTE esa fórmula.
//
// Se aplica como una EXENCIÓN conservadora, nunca al revés: un punto
// ya clasificado "prohibido"/"volumen_3" por distancia horizontal solo
// pasa a "fuera" si hay altura de instalación Y altura de techo
// CARGADAS y el punto queda positivamente por encima de ese límite —
// faltando cualquiera de los 2 datos, se mantiene el resultado
// horizontal de siempre (nunca se adivina para aflojar una
// restricción de seguridad). El Volumen 1 por la propia huella 3D de
// la bañera/ducha (en vez de solo un radio horizontal) y las
// excepciones MBTS/bloques de afeitadoras de la Tabla 1 siguen sin
// modelarse — casos especiales, no el tomacorriente estándar que esto
// evalúa.
export const ALTURA_LIMITE_VOLUMEN_BASE_M = 2.25;
export const ALTURA_LIMITE_VOLUMEN_TECHO_MAX_M = 3;

/** Altura real (desde el suelo) hasta la que se extiende el Volumen 1/2/3 en este ambiente — ver cita literal arriba. */
export function limiteAlturaM(alturaTechoM: number): number {
  return Math.min(alturaTechoM, ALTURA_LIMITE_VOLUMEN_TECHO_MAX_M);
}

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

/**
 * Punto de entrada único: ¿en qué zona de ITC-BT-27 cae `punto` (el de
 * un tomacorriente), según la fuente de agua más cercana del plano?
 * null = no hay ninguna fuente de agua marcada todavía, nada que
 * evaluar.
 *
 * `alturaPuntoM`/`alturaTechoM` (ambas opcionales, default null = el
 * comportamiento de siempre, horizontal únicamente): con las 2
 * cargadas, un punto que por distancia cae en zona restringida se
 * exime a "fuera" si está positivamente por encima de `limiteAlturaM`
 * — ver la cita literal de ITC-BT-27 §2.1.2/3/4 en la cabecera del
 * archivo. Nunca al revés (la altura no puede EMPEORAR un resultado
 * "fuera" por distancia).
 */
export function evaluarZonaBano<M extends MarcadorFuenteAgua>(
  punto: Punto,
  marcadores: M[] = [],
  alturaPuntoM: number | null = null,
  alturaTechoM: number | null = null
): ResultadoZonaBano | null {
  const cercana = fuenteAguaMasCercana(punto, marcadores);
  if (!cercana) return null;
  const radioVolumen1M =
    cercana.marcador.radioVolumen1M === "" || cercana.marcador.radioVolumen1M == null ? RADIO_VOLUMEN1_DEFECTO_M : Number(cercana.marcador.radioVolumen1M);
  const resultado = clasificarDistanciaBano(cercana.distanciaM, radioVolumen1M);
  if (resultado.zona === "fuera" || alturaPuntoM == null || alturaTechoM == null || !(alturaPuntoM >= 0) || !(alturaTechoM > 0)) return resultado;
  if (alturaPuntoM > limiteAlturaM(alturaTechoM)) {
    return { zona: "fuera", distanciaM: resultado.distanciaM, motivo: "" };
  }
  return resultado;
}
