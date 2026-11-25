// src/modules/plano/deteccionCaras.ts
//
// Detección de TODAS las caras (ambientes) del grafo de paredes ya
// trazado — deuda técnica listada en el README ("Detección de
// habitaciones limitada a lazos que cierran sobre su propio punto de
// inicio") y documentada como simplificación deliberada de Fase 1 en
// la nota de cabecera de modules/plano/index.ts: hasta ahora, un
// ambiente SOLO se registraba cuando el usuario trazaba una cadena de
// paredes que volvía literalmente a su propio nodo de partida — un
// plano con una pared interior que separa dos cuartos (un solo grafo,
// dos caras) no se detectaba solo, había que trazar cada cuarto por
// separado desde cero, repitiendo los tramos de pared compartidos.
//
// Algoritmo: recorrido de "siguiente medio-borde" sobre un grafo
// planar straight-line (el mismo usado por cualquier estructura
// doubly-connected-edge-list para enumerar caras) — cada arista no
// dirigida aporta 2 medio-bordes (uno por sentido); en cada nodo, los
// vecinos se ordenan por ángulo; al LLEGAR a un nodo por un
// medio-borde, el de la MISMA cara que sigue es el que está
// inmediatamente DESPUÉS del de vuelta en ese orden angular (con
// wraparound). Recorriendo así TODOS los medio-bordes no visitados se
// obtienen TODAS las caras del grafo — incluida, por cada componente
// conexa, su única cara EXTERIOR no acotada (fórmula de Euler:
// V-E+F=2, con F incluyendo la exterior).
//
// Signo del área (shoelace SIN valor absoluto) para distinguir
// acotada de exterior: verificado a mano con 2 casos (un cuadrado
// simple, y un rectángulo partido al medio por una pared interior —
// ver test_deteccion_caras.mjs para las cuentas completas) que, con
// ESTE criterio concreto de "siguiente en orden ANGULAR CRECIENTE
// después del de vuelta", toda cara ACOTADA sale con área CON SIGNO
// NEGATIVA y la exterior (una por componente conexa) sale POSITIVA —
// invariante topológico del algoritmo (Jordan/Green), no una
// coincidencia de un caso puntual, pero documentado así porque el
// signo concreto depende de esta elección de convención exacta (girar
// el criterio opuesto invertiría los signos igual de válidamente).
//
// Solo usa segmentos tipo "pared" — un "conductor" no define el
// contorno de ningún ambiente. Módulo puro, mismo criterio que el
// resto de modules/plano/.

import type { Punto, NodoPlano, SegmentoPlano } from "./tipos.ts";

export interface CaraDetectada {
  /** Ids de nodo que forman la cara, en orden (sin repetir el primero al final). */
  nodoIds: string[];
  /** Área real (positiva) de la cara, en m². */
  areaM2: number;
}

function medioBorde(origenId: string, destinoId: string): string {
  return `${origenId}\u0000${destinoId}`;
}

export function detectarCaras(nodos: NodoPlano[] = [], segmentos: SegmentoPlano[] = []): CaraDetectada[] {
  const paredes = segmentos.filter((s) => s.tipo === "pared" && s.nodoAId !== s.nodoBId);
  if (paredes.length < 3) return [];

  const puntoPorId = new Map<string, Punto>(nodos.map((n) => [n.id, n.punto]));
  const vecinosPorNodo = new Map<string, Set<string>>();
  function agregarVecino(desde: string, hacia: string) {
    if (!vecinosPorNodo.has(desde)) vecinosPorNodo.set(desde, new Set());
    vecinosPorNodo.get(desde)!.add(hacia);
  }
  for (const seg of paredes) {
    if (!puntoPorId.has(seg.nodoAId) || !puntoPorId.has(seg.nodoBId)) continue; // nodo huérfano — no debería pasar, no se revienta
    agregarVecino(seg.nodoAId, seg.nodoBId);
    agregarVecino(seg.nodoBId, seg.nodoAId);
  }

  // Vecinos de cada nodo, ordenados por ángulo ASCENDENTE (atan2) visto
  // desde ese nodo — base del recorrido "siguiente en orden angular".
  const vecinosOrdenados = new Map<string, string[]>();
  for (const [nodoId, vecinos] of vecinosPorNodo) {
    const origen = puntoPorId.get(nodoId)!;
    const lista = [...vecinos].sort((a, b) => {
      const pa = puntoPorId.get(a)!;
      const pb = puntoPorId.get(b)!;
      return Math.atan2(pa.y - origen.y, pa.x - origen.x) - Math.atan2(pb.y - origen.y, pb.x - origen.x);
    });
    vecinosOrdenados.set(nodoId, lista);
  }

  const visitados = new Set<string>();
  const caras: CaraDetectada[] = [];
  const limiteSeguridad = paredes.length * 2 + 10; // cota generosa — red de seguridad contra un bug de ciclo infinito, nunca debería alcanzarse

  for (const seg of paredes) {
    for (const [origenId, destinoId] of [
      [seg.nodoAId, seg.nodoBId],
      [seg.nodoBId, seg.nodoAId],
    ]) {
      if (visitados.has(medioBorde(origenId, destinoId))) continue;

      const nodoIds: string[] = [origenId];
      let actualOrigen = origenId;
      let actualDestino = destinoId;
      let pasos = 0;
      let cerrada = false;

      while (pasos++ < limiteSeguridad) {
        visitados.add(medioBorde(actualOrigen, actualDestino));
        if (actualDestino === origenId) {
          cerrada = true;
          break;
        }
        nodoIds.push(actualDestino);

        const vecinos = vecinosOrdenados.get(actualDestino) ?? [];
        const posVuelta = vecinos.indexOf(actualOrigen);
        if (posVuelta === -1 || vecinos.length === 0) break; // grafo inconsistente — no debería pasar, se corta sin reventar
        const siguiente = vecinos[(posVuelta + 1) % vecinos.length];

        actualOrigen = actualDestino;
        actualDestino = siguiente;
      }

      if (!cerrada || nodoIds.length < 3) continue; // cara degenerada (callejón sin salida) o cortada por la red de seguridad

      const puntos = nodoIds.map((id) => puntoPorId.get(id)!);
      let suma = 0;
      for (let i = 0; i < puntos.length; i++) {
        const a = puntos[i];
        const b = puntos[(i + 1) % puntos.length];
        suma += a.x * b.y - b.x * a.y;
      }
      // Negativa = acotada (ver nota de cabecera) — la exterior (positiva) se descarta acá mismo.
      if (suma < 0) caras.push({ nodoIds, areaM2: Math.abs(suma) / 2 });
    }
  }

  return caras;
}
