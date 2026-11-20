// src/modules/geometria/index.js
//
// Núcleo geométrico COMPARTIDO — ver PLANO_INTELIGENTE_DISENO.md §7.
// Puramente matemático: recibe puntos en METROS (espacio modelo, ya
// convertidos — ver modules/plano/calibracion.js) y no sabe nada de
// píxeles, canvas, zoom ni dispositivo. Pensado para que lo reutilicen
// TODOS los dominios geométricos futuros (plano arquitectónico hoy;
// tuberías/bandejas/rutas de conductores más adelante), igual criterio
// que shared/utils/ — un solo lugar para la matemática, nunca
// duplicada por dominio.
//
// Módulo puro — se usa a través de PlanoMediator (y de los mediadores
// de dominio que se agreguen después).

/** Distancia euclidiana entre dos puntos {x,y} en metros. */
export function distancia(p1, p2) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * Área de un polígono cerrado — fórmula del "shoelace" (estándar de la
 * industria, la misma que usa internamente cualquier GIS/CAD). `puntos`
 * es la lista ORDENADA de vértices (no hace falta repetir el primero al
 * final, el wraparound ya lo hace el módulo). Devuelve m².
 */
export function areaPoligono(puntos) {
  if (!Array.isArray(puntos) || puntos.length < 3) return 0;
  let suma = 0;
  for (let i = 0; i < puntos.length; i++) {
    const a = puntos[i];
    const b = puntos[(i + 1) % puntos.length];
    suma += a.x * b.y - b.x * a.y;
  }
  return Math.abs(suma) / 2;
}

/** Perímetro de un polígono cerrado (suma de lados, incluyendo el que cierra el último vértice con el primero). Devuelve metros. */
export function perimetroPoligono(puntos) {
  if (!Array.isArray(puntos) || puntos.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < puntos.length; i++) {
    const a = puntos[i];
    const b = puntos[(i + 1) % puntos.length];
    total += distancia(a, b);
  }
  return total;
}

/**
 * Longitud de una polilínea ABIERTA (ej. una ruta de conductor — a
 * diferencia de perimetroPoligono, NO cierra el último vértice con el
 * primero). Devuelve metros.
 */
export function longitudPolilinea(puntos) {
  if (!Array.isArray(puntos) || puntos.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < puntos.length - 1; i++) {
    total += distancia(puntos[i], puntos[i + 1]);
  }
  return total;
}
