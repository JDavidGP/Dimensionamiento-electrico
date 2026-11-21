// src/modules/geometria/vistaZoomPan.ts
//
// Transformación de vista (zoom + pan) — matemática pura, un solo
// espacio "modelo" (coordenadas propias de cada dominio: metros en el
// Plano, posición de nodo en el Diagrama unifilar) y un espacio
// "pantalla" (CSS pixels del <canvas>/<svg> ahora mismo — cambia con
// zoom/ventana/dispositivo). Reubicado acá (usuario, 2026-11-20, al
// pedir zoom/pan para el Diagrama unifilar) desde modules/plano/
// coordenadas.js, donde nació — es pura transformación afín 2D (escala
// + traslación, sin rotación), sin ningún concepto propio de Plano
// (imagen cargada, calibración de escala), así que corresponde acá, el
// núcleo compartido entre dominios geométricos (ver nota de cabecera
// de este módulo). Plano lo sigue usando igual que siempre, a través
// de PlanoMediator — cero cambio de comportamiento, solo de domicilio.
//
// CRÍTICO: `transformVista` es efímero — vive en estado de React del
// componente de render, nunca se persiste como parte del proyecto.
// Guardar y cerrar la vista "tal como estaba" no es responsabilidad de
// este módulo.
//
// Módulo puro — se usa a través de los mediadores de dominio
// (PlanoMediator, DiagramaMediator).
//
// Primer módulo migrado a TypeScript (usuario, 2026-11-21, "ya después
// podés TypeScript" — migración incremental, empezando por el núcleo
// más puro y reutilizado) — ver tsconfig.json para el criterio
// (allowJs/checkJs: conviven .js sin tipar y .ts estricto mientras
// dure la migración).

import type { Punto } from "./tipos.ts";

export interface TransformVista {
  zoom: number;
  panX: number;
  panY: number;
}

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 8;

function clamp(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor));
}

export function transformVistaInicial(): TransformVista {
  return { zoom: 1, panX: 0, panY: 0 };
}

/** Punto en espacio MODELO → punto en espacio PANTALLA (para dibujar). */
export function aPantalla(puntoModelo: Punto, transformVista: TransformVista): Punto {
  return {
    x: puntoModelo.x * transformVista.zoom + transformVista.panX,
    y: puntoModelo.y * transformVista.zoom + transformVista.panY,
  };
}

/** Punto en espacio PANTALLA (ej. un click) → punto en espacio MODELO. */
export function aModelo(puntoPantalla: Punto, transformVista: TransformVista): Punto {
  return {
    x: (puntoPantalla.x - transformVista.panX) / transformVista.zoom,
    y: (puntoPantalla.y - transformVista.panY) / transformVista.zoom,
  };
}

/**
 * Aplica un factor de zoom (ej. 1.1 = acercar 10%, 1/1.1 = alejar)
 * manteniendo fijo en pantalla el punto `pivotePantalla` (el cursor o
 * el centro del gesto de pinch) — es el comportamiento estándar de
 * cualquier editor (CAD, Google Maps, Figma): hace zoom "hacia donde
 * apunta el usuario", no hacia la esquina superior izquierda.
 */
export function aplicarZoom(transformVista: TransformVista, factor: number, pivotePantalla: Punto): TransformVista {
  const pivoteModeloAntes = aModelo(pivotePantalla, transformVista);
  const nuevoZoom = clamp(transformVista.zoom * factor, ZOOM_MIN, ZOOM_MAX);
  const transformConNuevoZoom = { ...transformVista, zoom: nuevoZoom };
  const pivotePantallaDespues = aPantalla(pivoteModeloAntes, transformConNuevoZoom);
  return {
    zoom: nuevoZoom,
    panX: transformConNuevoZoom.panX + (pivotePantalla.x - pivotePantallaDespues.x),
    panY: transformConNuevoZoom.panY + (pivotePantalla.y - pivotePantallaDespues.y),
  };
}

/** Desplaza la vista (arrastrar/pan) — `deltaPantalla` en CSS pixels. */
export function aplicarPan(transformVista: TransformVista, deltaPantalla: Punto): TransformVista {
  return {
    ...transformVista,
    panX: transformVista.panX + deltaPantalla.x,
    panY: transformVista.panY + deltaPantalla.y,
  };
}

/**
 * "Ajustar a la ventana" — el transformVista que hace entrar el
 * contenido completo (de `anchoModelo`×`altoModelo`) en el canvas
 * actual, centrado, con un margen chico. Se recalcula en CADA
 * dispositivo a partir del tamaño de SU canvas en ESE momento — nunca
 * se restaura desde el archivo guardado (mismo motivo que en Plano,
 * ver PLANO_INTELIGENTE_DISENO.md §4, tabla de escenarios).
 */
export function ajustarAVentana(anchoModelo: number, altoModelo: number, anchoCanvas: number, altoCanvas: number): TransformVista {
  if (!(anchoModelo > 0) || !(altoModelo > 0) || !(anchoCanvas > 0) || !(altoCanvas > 0)) {
    return transformVistaInicial();
  }
  const zoom = clamp(Math.min(anchoCanvas / anchoModelo, altoCanvas / altoModelo) * 0.95, ZOOM_MIN, ZOOM_MAX);
  return {
    zoom,
    panX: (anchoCanvas - anchoModelo * zoom) / 2,
    panY: (altoCanvas - altoModelo * zoom) / 2,
  };
}
