// src/modules/plano/alturaInstalacion.ts
//
// Usuario, 2026-11-25: "hay que tomar en cuenta la altura donde se
// instala un interruptor [o] tomacorriente" — hasta esta ronda, la
// longitud de un conductor trazado en el Plano (ver cruceParedes.ts)
// era SOLO el recorrido horizontal + el extra de cruzar paredes, nunca
// la bajada/subida vertical real desde donde corre el conductor hasta
// la altura de instalación del equipo. Esta pieza calcula ESE extra,
// sin inventar ningún dato: si falta la altura del equipo, o la altura
// de techo de su ambiente (cuando la referencia es "techo"), no se
// suma nada — nunca un número adivinado.
//
// Decisión de referencia confirmada por el usuario: por defecto el
// conductor corre por el CIELO/TECHO y baja hasta el equipo (lo más
// común en residencial con cielo falso o losa) — `referenciaAltura`
// por equipo permite cambiarlo a "piso" (sube desde el piso) cuando la
// instalación real va embutida por el piso/zócalo.

import type { Punto, NodoPlano, SegmentoPlano, HabitacionPlano, RutaConductorPlano, MarcadorEquipoPlano } from "./tipos.ts";
import { distancia, puntoDentroDePoligono } from "../geometria/index.ts";
import { calcularCrucesPared, type ResultadoCrucesPared } from "./cruceParedes.ts";

// Nunca importa de "./index.ts" (que a su vez exporta ESTE archivo) —
// evitaría un ciclo de módulos. Por eso reimplementa, en 2 funciones
// chicas, el mismo criterio que ya usan nodoCercano/habitacionQueContiene
// ahí (radio de pegado de 30cm, "primer ambiente que contiene el
// punto"), en vez de depender de esas dos.
const RADIO_SNAP_METROS_LOCAL = 0.3;

function marcadorCercano<M extends { punto: Punto }>(puntoModelo: Punto, marcadores: M[], radio: number): M | null {
  let masCercano: M | null = null;
  let menorDistancia = Infinity;
  for (const m of marcadores) {
    const d = distancia(puntoModelo, m.punto);
    if (d <= radio && d < menorDistancia) {
      masCercano = m;
      menorDistancia = d;
    }
  }
  return masCercano;
}

function habitacionQueContienePunto(puntoModelo: Punto, habitaciones: HabitacionPlano[], nodos: NodoPlano[]): HabitacionPlano | null {
  for (const h of habitaciones) {
    const puntos = h.nodoIds.map((id) => nodos.find((n) => n.id === id)?.punto).filter((p): p is Punto => Boolean(p));
    if (puntos.length >= 3 && puntoDentroDePoligono(puntoModelo, puntos)) return h;
  }
  return null;
}

/** Forma mínima de un Equipo que esta pieza necesita leer — evita acoplar modules/plano al dominio Equipo completo (modules/validacion/tipos.ts), mismo criterio que ConTableroId en modules/tablero. */
export interface EquipoConAltura {
  id: string;
  alturaInstalacionM?: number | string | null;
  referenciaAltura?: "techo" | "piso" | null;
}

export interface ResultadoAlturaInstalacion {
  /** true = se encontró un equipo con altura de instalación cargada en el extremo de la ruta (independientemente de si se pudo calcular el extra). */
  aplica: boolean;
  /** Metros a sumar — 0 si no aplica o si falta un dato para calcularlo (nunca se inventa). */
  extraM: number;
  equipoId: string | null;
  referencia: "techo" | "piso" | null;
  /** Altura de techo efectivamente usada (solo con referencia "techo") — null si no se pudo determinar (falta en el ambiente Y en el plano general). */
  alturaTechoUsadaM: number | null;
  /** Por qué no se pudo calcular un extra >0 aunque `aplica` sea true — null si se calculó bien o si no aplica. */
  motivo: string | null;
}

const SIN_EXTRA: ResultadoAlturaInstalacion = { aplica: false, extraM: 0, equipoId: null, referencia: null, alturaTechoUsadaM: null, motivo: null };

/**
 * Bajada/subida vertical hasta el equipo real que queda en el extremo
 * final de `ruta` (si hay uno con marcador ahí, dentro del radio de
 * pegado ya usado en todo el Plano — mismo `nodoCercano` genérico que
 * "pegar conductor a equipo"). Una ruta vinculada a un TABLERO (no un
 * equipo) nunca encuentra un equipo en su extremo — `aplica: false`,
 * cero cambio de comportamiento para ese caso.
 */
export function calcularExtraAlturaInstalacion(
  ruta: RutaConductorPlano,
  nodos: NodoPlano[],
  marcadoresEquipoPlano: MarcadorEquipoPlano[] = [],
  equipos: EquipoConAltura[] = [],
  habitaciones: HabitacionPlano[] = [],
  alturaTechoGeneralM: number | null = null
): ResultadoAlturaInstalacion {
  const ultimoNodoId = ruta.nodoIds[ruta.nodoIds.length - 1];
  const puntoFinal: Punto | undefined = nodos.find((n) => n.id === ultimoNodoId)?.punto;
  if (!puntoFinal) return SIN_EXTRA;

  const marcador = marcadorCercano(puntoFinal, marcadoresEquipoPlano, RADIO_SNAP_METROS_LOCAL);
  if (!marcador?.entidadId) return SIN_EXTRA;

  const equipo = equipos.find((e) => e.id === marcador.entidadId);
  if (!equipo) return SIN_EXTRA;

  const alturaInstalacionM = equipo.alturaInstalacionM === "" || equipo.alturaInstalacionM == null ? null : Number(equipo.alturaInstalacionM);
  if (alturaInstalacionM == null || !(alturaInstalacionM >= 0)) return SIN_EXTRA;

  const referencia = equipo.referenciaAltura === "piso" ? "piso" : "techo"; // default "techo", confirmado por el usuario

  if (referencia === "piso") {
    return { aplica: true, extraM: alturaInstalacionM, equipoId: equipo.id, referencia, alturaTechoUsadaM: null, motivo: null };
  }

  // referencia "techo": hace falta la altura de techo del ambiente que
  // contiene al equipo (o, si ese ambiente no la declaró, la altura
  // general del plano) — sin ninguna de las dos, no se inventa un
  // valor, se reporta el motivo y el extra queda en 0.
  const ambiente = habitacionQueContienePunto(marcador.punto, habitaciones, nodos);
  const alturaTechoUsadaM = ambiente?.alturaM ?? alturaTechoGeneralM ?? null;
  if (alturaTechoUsadaM == null) {
    return {
      aplica: true,
      extraM: 0,
      equipoId: equipo.id,
      referencia,
      alturaTechoUsadaM: null,
      motivo: "Falta la altura de techo (del ambiente o general del plano) para calcular la bajada.",
    };
  }

  if (alturaInstalacionM > alturaTechoUsadaM) {
    // Dato físicamente imposible (el equipo quedaría más alto que el
    // techo) — no se inventa un extra negativo, se avisa en vez de
    // sumar un número sin sentido.
    return {
      aplica: true,
      extraM: 0,
      equipoId: equipo.id,
      referencia,
      alturaTechoUsadaM,
      motivo: `La altura de instalación (${alturaInstalacionM}m) supera la altura de techo (${alturaTechoUsadaM}m) — revisá alguno de los dos datos.`,
    };
  }

  return { aplica: true, extraM: alturaTechoUsadaM - alturaInstalacionM, equipoId: equipo.id, referencia, alturaTechoUsadaM, motivo: null };
}

export interface ResultadoLongitudEsperada extends ResultadoCrucesPared {
  alturaInstalacion: ResultadoAlturaInstalacion;
  /** longitudTotalM (de calcularCrucesPared) + alturaInstalacion.extraM — la longitud real completa, única fuente que usan tanto "Usar esta longitud" como la advertencia de distancia desincronizada (Paso A), para que nunca diverjan entre sí. */
  longitudTotalConAlturaM: number;
}

/**
 * Longitud REAL completa de una ruta: recorrido trazado + cruces de
 * pared (calcularCrucesPared) + la bajada/subida al equipo de su
 * extremo, si corresponde (calcularExtraAlturaInstalacion arriba).
 * Punto de entrada único — evita que "Usar esta longitud" y la
 * advertencia de desincronización calculen la longitud de formas
 * distintas y terminen en desacuerdo entre sí.
 */
export function calcularLongitudEsperadaRuta(
  ruta: RutaConductorPlano,
  nodos: NodoPlano[],
  segmentosPared: SegmentoPlano[],
  marcadoresEquipoPlano: MarcadorEquipoPlano[] = [],
  equipos: EquipoConAltura[] = [],
  habitaciones: HabitacionPlano[] = [],
  alturaTechoGeneralM: number | null = null
): ResultadoLongitudEsperada {
  const base = calcularCrucesPared(ruta, nodos, segmentosPared);
  const alturaInstalacion = calcularExtraAlturaInstalacion(ruta, nodos, marcadoresEquipoPlano, equipos, habitaciones, alturaTechoGeneralM);
  return { ...base, alturaInstalacion, longitudTotalConAlturaM: base.longitudTotalM + alturaInstalacion.extraM };
}
