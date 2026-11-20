// src/modules/plano/index.js
//
// Dominio Plano — grafo de nodos/segmentos (paredes) en espacio MODELO
// (metros reales, ya calibrados — ver calibracion.js) + habitaciones
// derivadas. Mismo patrón de grafo de nodos y aristas que ya usa el
// diagrama unifilar (nodosDiagrama/conexionesDiagrama) — ver
// PLANO_INTELIGENTE_DISENO.md §7, no es un paradigma nuevo para esta
// app, es el mismo extendido a coordenadas reales.
//
// FASE 1 (2026-11-20, "construí la fase 1"): calibración + trazado
// MANUAL de paredes. Detección automática de habitaciones arbitrarias
// (caras de un grafo planar cualquiera) es un problema de geometría
// computacional bastante más grande — para esta fase, una "habitación"
// se registra cuando el usuario traza una cadena de paredes que
// VUELVE a su propio nodo de inicio (un lazo cerrado), no por análisis
// general del grafo. Simplificación deliberada, documentada acá para
// que quede claro que no es un olvido: una futura ronda podría agregar
// detección de ciclos arbitrarios si hiciera falta.
//
// CERO cálculo eléctrico, CERO React, CERO canvas/zoom — eso vive en
// PlanoCanvas.jsx (render) y en el hook (estado de sesión de trazado,
// como `origenPendiente` ya vive en DiagramaUnifilar.jsx, no acá).
//
// Módulo puro — se usa a través de PlanoMediator, igual criterio que
// modules/tablero/index.js con TableroMediator.

import { generarId } from "../../shared/utils/id.js";
import { distancia, areaPoligono, perimetroPoligono } from "../geometria/index.js";

export { calcularEscala, imagenAModelo, modeloAImagen } from "./calibracion.js";
export { transformVistaInicial, aPantalla, aModelo, aplicarZoom, aplicarPan, ajustarAVentana, ZOOM_MIN, ZOOM_MAX } from "./coordenadas.js";

// Radio de "pegado" al trazar — un click a menos de 30cm (en el mundo
// real, no en píxeles de pantalla: así es independiente del zoom) de
// un nodo ya existente reusa ESE nodo en vez de crear uno superpuesto.
// Imprescindible para poder cerrar polígonos (dos paredes que
// comparten una esquina comparten el mismo nodo — FK, no copia, mismo
// criterio que circuito.tableroId en el resto de la app).
export const RADIO_SNAP_METROS = 0.3;

export function crearNodo(puntoModelo) {
  return { id: generarId(), punto: puntoModelo };
}

/** Nodo existente más cercano a `puntoModelo`, dentro de `radio` metros — o null si ninguno califica. */
export function nodoCercano(puntoModelo, nodos = [], radio = RADIO_SNAP_METROS) {
  let masCercano = null;
  let menorDistancia = Infinity;
  for (const nodo of nodos) {
    const d = distancia(puntoModelo, nodo.punto);
    if (d <= radio && d < menorDistancia) {
      masCercano = nodo;
      menorDistancia = d;
    }
  }
  return masCercano;
}

export function crearSegmento(nodoAId, nodoBId, tipo = "pared") {
  return { id: generarId(), nodoAId, nodoBId, tipo };
}

/**
 * Elimina un nodo y, en cascada, los segmentos que lo usaban y las
 * habitaciones que lo tenían como vértice (no quedan apuntando a un id
 * muerto) — mismo criterio que liberarCircuitosDeTablero.
 */
export function eliminarNodo(nodoId, nodos = [], segmentos = [], habitaciones = []) {
  return {
    nodos: nodos.filter((n) => n.id !== nodoId),
    segmentos: segmentos.filter((s) => s.nodoAId !== nodoId && s.nodoBId !== nodoId),
    habitaciones: habitaciones.filter((h) => !h.nodoIds.includes(nodoId)),
  };
}

export function eliminarSegmento(segmentoId, segmentos = []) {
  return segmentos.filter((s) => s.id !== segmentoId);
}

/**
 * Registra una habitación a partir de una cadena de nodos YA cerrada
 * (el último igual al primero no hace falta repetirlo — ver nota de
 * Fase 1 arriba). Calcula área/perímetro de una — no se vuelven a
 * tocar a mano después (mismo criterio anti-doble-escritura que el
 * resto de la app: son datos DERIVADOS del grafo, no una segunda copia).
 */
export function crearHabitacion(nodoIds, nodos = [], nombre = "") {
  const puntos = nodoIds.map((id) => nodos.find((n) => n.id === id)?.punto).filter(Boolean);
  if (puntos.length < 3) return null;
  return {
    id: generarId(),
    nodoIds,
    nombre: nombre?.trim() || "Ambiente sin nombre",
    areaM2: areaPoligono(puntos),
    perimetroM: perimetroPoligono(puntos),
  };
}
