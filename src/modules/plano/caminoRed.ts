// src/modules/plano/caminoRed.ts
//
// Camino más corto sobre la red de conductores YA trazada en el plano
// — usuario, 2026-11-25, al pensar "Sugerir ruta automática" como una
// instalación real: calibrar → ubicar cajas de empalme → trazar la
// red de rutas por donde SE PUEDE tender un conductor → el resto se
// conecta solo, arrastrando los circuitos ya vinculados. "La red" NO
// es un concepto nuevo — es la unión de los segmentos tipo "conductor"
// que ya se trazan a mano con "Trazar conductor" (mismo grafo de
// nodos/segmentos que usan las paredes). Esta función no sabe nada de
// equipos/circuitos/tableros — solo de grafos: dados 2 nodos, el
// camino más corto (Dijkstra, los pesos son la distancia real en
// metros entre nodos consecutivos) usando SOLO segmentos "conductor".
//
// Módulo puro — mismo criterio que el resto de modules/plano/.

import { distancia } from "../geometria/index.ts";
import type { Punto, NodoPlano, SegmentoPlano } from "./tipos.ts";

export interface CaminoEncontrado {
  nodoIds: string[];
  longitudM: number;
}

/**
 * Camino más corto entre `origenId` y `destinoId`, usando solo
 * segmentos tipo "conductor" (una pared no es un camino permitido para
 * un cable). `null` si no hay camino — nunca inventa una conexión
 * recta que no exista en la red ya trazada.
 */
export function caminoMasCorto(origenId: string, destinoId: string, nodos: NodoPlano[] = [], segmentos: SegmentoPlano[] = []): CaminoEncontrado | null {
  if (origenId === destinoId) return { nodoIds: [origenId], longitudM: 0 };

  const puntoPorId = new Map<string, Punto>(nodos.map((n) => [n.id, n.punto]));
  if (!puntoPorId.has(origenId) || !puntoPorId.has(destinoId)) return null;

  const vecinosPorNodo = new Map<string, Array<{ hacia: string; pesoM: number }>>();
  function agregarArista(desde: string, hacia: string, pesoM: number) {
    if (!vecinosPorNodo.has(desde)) vecinosPorNodo.set(desde, []);
    vecinosPorNodo.get(desde)!.push({ hacia, pesoM });
  }
  for (const seg of segmentos) {
    if (seg.tipo !== "conductor") continue;
    const a = puntoPorId.get(seg.nodoAId);
    const b = puntoPorId.get(seg.nodoBId);
    if (!a || !b) continue;
    const pesoM = distancia(a, b);
    agregarArista(seg.nodoAId, seg.nodoBId, pesoM);
    agregarArista(seg.nodoBId, seg.nodoAId, pesoM);
  }

  // Dijkstra — cola de prioridad implementada a mano (sin librería
  // nueva para esto, la red de un plano real es chica: decenas de
  // nodos, no miles) con un array + búsqueda lineal del mínimo.
  const distanciaDesdeOrigen = new Map<string, number>([[origenId, 0]]);
  const anteriorDe = new Map<string, string>();
  const visitados = new Set<string>();
  const pendientes = [origenId];

  while (pendientes.length > 0) {
    let iMinimo = 0;
    for (let i = 1; i < pendientes.length; i++) {
      if ((distanciaDesdeOrigen.get(pendientes[i]) ?? Infinity) < (distanciaDesdeOrigen.get(pendientes[iMinimo]) ?? Infinity)) iMinimo = i;
    }
    const actual = pendientes.splice(iMinimo, 1)[0];
    if (visitados.has(actual)) continue;
    visitados.add(actual);
    if (actual === destinoId) break;

    for (const { hacia, pesoM } of vecinosPorNodo.get(actual) ?? []) {
      if (visitados.has(hacia)) continue;
      const distanciaCandidata = (distanciaDesdeOrigen.get(actual) ?? Infinity) + pesoM;
      if (distanciaCandidata < (distanciaDesdeOrigen.get(hacia) ?? Infinity)) {
        distanciaDesdeOrigen.set(hacia, distanciaCandidata);
        anteriorDe.set(hacia, actual);
        pendientes.push(hacia);
      }
    }
  }

  if (!visitados.has(destinoId)) return null; // sin camino en la red trazada — nunca se inventa una línea recta

  const nodoIds: string[] = [destinoId];
  let cursor = destinoId;
  while (cursor !== origenId) {
    cursor = anteriorDe.get(cursor)!;
    nodoIds.unshift(cursor);
  }
  return { nodoIds, longitudM: distanciaDesdeOrigen.get(destinoId) ?? 0 };
}
