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
import { distancia, areaPoligono, perimetroPoligono, longitudPolilinea } from "../geometria/index.js";

export { calcularEscala, imagenAModelo, modeloAImagen } from "./calibracion.js";
export { transformVistaInicial, aPantalla, aModelo, aplicarZoom, aplicarPan, ajustarAVentana, ZOOM_MIN, ZOOM_MAX } from "./coordenadas.js";
export { pixelBordeMasFuerte, RADIO_BUSQUEDA_BORDE_PX, UMBRAL_MAGNITUD_BORDE } from "./deteccionBordes.js";
export { calcularHomografia, aplicarHomografia, invertirMatriz3x3 } from "./homografia.js";
export { generarDXF, codificarDXFComoBytes } from "./exportarDXF.js";

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
 * Elimina un nodo y, en cascada, los segmentos que lo usaban, las
 * habitaciones que lo tenían como vértice y las rutas de conductor que
 * lo usaban (no quedan apuntando a un id muerto) — mismo criterio que
 * liberarCircuitosDeTablero.
 */
export function eliminarNodo(nodoId, nodos = [], segmentos = [], habitaciones = [], rutasConductor = []) {
  return {
    nodos: nodos.filter((n) => n.id !== nodoId),
    segmentos: segmentos.filter((s) => s.nodoAId !== nodoId && s.nodoBId !== nodoId),
    habitaciones: habitaciones.filter((h) => !h.nodoIds.includes(nodoId)),
    rutasConductor: rutasConductor.filter((r) => !r.nodoIds.includes(nodoId)),
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

// --- Rutas de conductor — Fase 2, 3ra ronda (2026-11-20) ---
//
// Misma idea que una habitación, pero para una cadena de nodos
// ABIERTA (una ruta de punto a punto, no un lazo cerrado): los
// segmentos que la forman ya se crean con crearSegmento(... , "conductor")
// — igual mecanismo de trazado/"pegado" que las paredes, reutilizado
// tal cual, solo cambia el `tipo` del segmento. Acá solo se registra
// la ruta COMPLETA (qué nodos la forman, en orden) + su longitud total
// — derivada, nunca una segunda copia editable a mano.

/** Registra una ruta de conductor a partir de una cadena de nodos (abierta, >= 2). */
export function crearRutaConductor(nodoIds, nodos = [], nombre = "") {
  const puntos = nodoIds.map((id) => nodos.find((n) => n.id === id)?.punto).filter(Boolean);
  if (puntos.length < 2) return null;
  return {
    id: generarId(),
    nodoIds,
    nombre: nombre?.trim() || "Ruta sin nombre",
    longitudM: longitudPolilinea(puntos),
  };
}

export function eliminarRutaConductor(rutaId, rutas = []) {
  return rutas.filter((r) => r.id !== rutaId);
}

// --- Equipos ubicados en el plano — Fase 2, 3ra ronda (2026-11-20) ---
//
// Un marcador puntual (no forma parte del grafo de nodos/segmentos —
// ver la nota en PlanoInteligente.jsx sobre por qué quedan
// independientes en esta ronda) con un `tipo` del MISMO catálogo que
// ya usa el diagrama unifilar (shared/data/bibliotecaComponentes.js —
// ver PlanoMediator para `obtenerComponente`/`componentesPorCategoria`
// reexportados, nunca un segundo catálogo) y un `entidadId` opcional
// que lo vincula a un tablero/circuito/equipo/fuenteEnergia/
// transformador YA existente en el proyecto — mismo "modelo canónico"
// de ARCHITECTURE.md §9 (el marcador es una VISTA sobre la entidad
// real, nunca duplica sus datos eléctricos).
//
// DECISIÓN DELIBERADA: la lista de "entidades ya vinculadas" para
// excluir de los candidatos es PROPIA del plano (no cruza con los
// vínculos que ya tenga el diagrama unifilar) — la misma entidad
// (ej. un tablero) puede aparecer legítimamente en ambas vistas a la
// vez: el diagrama muestra su TOPOLOGÍA eléctrica, el plano su
// UBICACIÓN física — no es el mismo recurso "usado dos veces", son
// dos aspectos distintos del mismo dato.

export function crearMarcadorEquipo(puntoModelo, tipo, entidadId = null, nombre = "") {
  return { id: generarId(), punto: puntoModelo, tipo, entidadId: entidadId || null, nombre: nombre?.trim() || "" };
}

export function editarMarcadorEquipo(marcador, cambios) {
  return { ...marcador, ...cambios };
}

export function eliminarMarcadorEquipo(marcadorId, marcadores = []) {
  return marcadores.filter((m) => m.id !== marcadorId);
}

/** Marcadores que apuntaban a una entidad eliminada quedan desvinculados (entidadId -> null), nunca borrados ni apuntando a un id muerto. */
export function liberarMarcadoresDeEntidad(entidadId, marcadores = []) {
  return marcadores.map((m) => (m.entidadId === entidadId ? { ...m, entidadId: null } : m));
}
