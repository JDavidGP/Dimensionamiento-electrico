// src/modules/plano/cruceParedes.ts
//
// Motor geométrico: cuánto conducto EXTRA necesita una ruta de
// conductor al atravesar cada pared que cruza en el plano — usuario,
// 2026-11-22 ("creemos un motor que realice cálculos geométricos más
// exacto" en vez de que el instalador anote el extra a mano): a partir
// de datos YA medidos (espesorM de cada pared, 2 clicks — ver
// crearSegmento en index.ts) y YA trazados (la ruta de conductor, nodo
// a nodo), se deriva el extra sin pedir un dato nuevo.
//
// FÍSICA: un conductor que cruza una pared de espesor `t` en un ÁNGULO
// theta respecto a la CARA de la pared (no necesariamente
// perpendicular) no atraviesa `t` de material, sino `t / sin(theta)`
// — la "distancia inclinada" de cruzar una capa de espesor conocido en
// diagonal. Cruce perpendicular (theta=90°) → extra = t exacto, el
// mínimo físicamente posible. Cruce casi paralelo a la pared
// (theta→0°) → el extra crece sin límite (en la práctica, el
// conductor correría DENTRO de la pared, no cruzándola) — por debajo
// de ANGULO_MINIMO_CRUCE_GRADOS se marca `extraM: null`
// (indeterminado) en vez de devolver un número sin sentido físico.
//
// Reusa interseccionSegmentos/anguloAgudoEntreSegmentos de
// modules/geometria/ (esa función ya se pensó desde su creación para
// "rutas de conductores", ver su propia nota de cabecera) — CERO
// matemática de intersección nueva acá, solo la orquestación propia
// del dominio Plano (qué es una "pared", qué es una "ruta").

import { interseccionSegmentos, anguloAgudoEntreSegmentos } from "../geometria/index.ts";
import type { Punto, NodoPlano, SegmentoPlano, RutaConductorPlano } from "./tipos.ts";

/** Por debajo de este ángulo (grados) el cruce es demasiado oblicuo para un extra confiable — ver nota de cabecera. */
export const ANGULO_MINIMO_CRUCE_GRADOS = 15;

export interface CrucePared {
  segmentoParedId: string;
  anguloGrados: number;
  /** metros de conducto extra que agrega ESTE cruce — null = ángulo demasiado oblicuo, indeterminado (ver ANGULO_MINIMO_CRUCE_GRADOS). */
  extraM: number | null;
  punto: Punto;
}

export interface ResultadoCrucesPared {
  cruces: CrucePared[];
  /** Suma de extraM de los cruces CON valor conocido (los indeterminados no suman, para no mezclar un número real con uno inventado). */
  extraTotalM: number;
  /** ids de pared cruzadas pero sin espesorM medido todavía — no se inventa un valor, el llamador decide cómo avisarlo. */
  paredesSinEspesor: string[];
  /** ids de pared cruzadas en un ángulo demasiado oblicuo (ver ANGULO_MINIMO_CRUCE_GRADOS) — el extra de ESE cruce no entra en extraTotalM. */
  paredesAnguloIndeterminado: string[];
  longitudBaseM: number;
  /** longitudBaseM + extraTotalM — la estimación más precisa disponible, ya que los cruces indeterminados/sin espesor no se inventan. */
  longitudTotalM: number;
}

/**
 * Cruces de PARED de una ruta de conductor, con el extra de longitud
 * de cada uno — recorre cada tramo de la ruta (nodo a nodo consecutivo
 * en `ruta.nodoIds`) contra cada segmento de tipo "pared" en
 * `segmentosPared`, usando intersección geométrica real (NO comparte
 * nodos: una ruta de conductor y una pared se trazan de forma
 * independiente, pueden cruzarse en cualquier punto interior de sus
 * propios tramos).
 */
export function calcularCrucesPared(ruta: RutaConductorPlano, nodos: NodoPlano[], segmentosPared: SegmentoPlano[]): ResultadoCrucesPared {
  const puntosRuta = ruta.nodoIds.map((id) => nodos.find((n) => n.id === id)?.punto).filter((p): p is Punto => Boolean(p));

  const cruces: CrucePared[] = [];
  const paredesSinEspesor: string[] = [];
  const paredesAnguloIndeterminado: string[] = [];

  for (let i = 0; i < puntosRuta.length - 1; i++) {
    const c1 = puntosRuta[i];
    const c2 = puntosRuta[i + 1];

    for (const pared of segmentosPared) {
      const nodoA = nodos.find((n) => n.id === pared.nodoAId);
      const nodoB = nodos.find((n) => n.id === pared.nodoBId);
      if (!nodoA || !nodoB) continue;

      const punto = interseccionSegmentos(c1, c2, nodoA.punto, nodoB.punto);
      if (!punto) continue;

      if (!(Number(pared.espesorM) > 0)) {
        paredesSinEspesor.push(pared.id);
        continue;
      }

      const anguloRad = anguloAgudoEntreSegmentos(c1, c2, nodoA.punto, nodoB.punto);
      const anguloGrados = (anguloRad * 180) / Math.PI;

      if (anguloGrados < ANGULO_MINIMO_CRUCE_GRADOS) {
        paredesAnguloIndeterminado.push(pared.id);
        cruces.push({ segmentoParedId: pared.id, anguloGrados, extraM: null, punto });
        continue;
      }

      cruces.push({ segmentoParedId: pared.id, anguloGrados, extraM: Number(pared.espesorM) / Math.sin(anguloRad), punto });
    }
  }

  const extraTotalM = cruces.reduce((suma, c) => suma + (c.extraM ?? 0), 0);
  const longitudBaseM = ruta.longitudM;

  return {
    cruces,
    extraTotalM,
    paredesSinEspesor,
    paredesAnguloIndeterminado,
    longitudBaseM,
    longitudTotalM: longitudBaseM + extraTotalM,
  };
}
