// src/modules/plano/coordenadas.js
//
// Sistema de coordenadas — ver PLANO_INTELIGENTE_DISENO.md §1-2. Solo
// sabe de DOS espacios: "imagen" (píxeles del archivo cargado — fijos,
// propiedad del archivo) y "pantalla" (CSS pixels del <canvas>/<svg>
// ahora mismo — cambia con zoom/ventana/dispositivo). `transformVista`
// (zoom + pan) es SIEMPRE un parámetro explícito, nunca se lee de
// `window` ni del DOM acá — eso lo resuelve quien llama (el componente
// de render), este módulo es matemática pura (una transformación afín
// 2D: escala + traslación, sin rotación en v1).
//
// CRÍTICO: `transformVista` es efímero — vive en estado de React del
// componente de render, nunca se persiste como parte del proyecto (ver
// useCircuitos.js / PlanoInteligente.jsx). Guardar y cerrar la vista
// "tal como estaba" no es responsabilidad de este módulo.
//
// Módulo puro — se usa a través de PlanoMediator.

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 8;

function clamp(valor, min, max) {
  return Math.min(max, Math.max(min, valor));
}

export function transformVistaInicial() {
  return { zoom: 1, panX: 0, panY: 0 };
}

/** Punto en espacio IMAGEN → punto en espacio PANTALLA (para dibujar). */
export function aPantalla(puntoImagen, transformVista) {
  return {
    x: puntoImagen.x * transformVista.zoom + transformVista.panX,
    y: puntoImagen.y * transformVista.zoom + transformVista.panY,
  };
}

/** Punto en espacio PANTALLA (ej. un click) → punto en espacio IMAGEN. */
export function aModelo(puntoPantalla, transformVista) {
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
export function aplicarZoom(transformVista, factor, pivotePantalla) {
  const pivoteImagenAntes = aModelo(pivotePantalla, transformVista);
  const nuevoZoom = clamp(transformVista.zoom * factor, ZOOM_MIN, ZOOM_MAX);
  const transformConNuevoZoom = { ...transformVista, zoom: nuevoZoom };
  const pivotePantallaDespues = aPantalla(pivoteImagenAntes, transformConNuevoZoom);
  return {
    zoom: nuevoZoom,
    panX: transformConNuevoZoom.panX + (pivotePantalla.x - pivotePantallaDespues.x),
    panY: transformConNuevoZoom.panY + (pivotePantalla.y - pivotePantallaDespues.y),
  };
}

/** Desplaza la vista (arrastrar/pan) — `deltaPantalla` en CSS pixels. */
export function aplicarPan(transformVista, deltaPantalla) {
  return {
    ...transformVista,
    panX: transformVista.panX + deltaPantalla.x,
    panY: transformVista.panY + deltaPantalla.y,
  };
}

/**
 * "Ajustar a la ventana" — el transformVista que hace entrar la imagen
 * completa en el canvas actual, centrada, con un margen chico. Se
 * recalcula en CADA dispositivo a partir del tamaño de SU canvas en
 * ESE momento — nunca se restaura desde el archivo guardado (ver nota
 * en PLANO_INTELIGENTE_DISENO.md §4, tabla de escenarios).
 */
export function ajustarAVentana(anchoImagen, altoImagen, anchoCanvas, altoCanvas) {
  if (!(anchoImagen > 0) || !(altoImagen > 0) || !(anchoCanvas > 0) || !(altoCanvas > 0)) {
    return transformVistaInicial();
  }
  const zoom = clamp(Math.min(anchoCanvas / anchoImagen, altoCanvas / altoImagen) * 0.95, ZOOM_MIN, ZOOM_MAX);
  return {
    zoom,
    panX: (anchoCanvas - anchoImagen * zoom) / 2,
    panY: (altoCanvas - altoImagen * zoom) / 2,
  };
}
