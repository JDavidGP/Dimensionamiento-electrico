// src/modules/geometria/index.ts
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
//
// Migrado a TypeScript (usuario, 2026-11-21) — ver la nota en
// vistaZoomPan.ts.

import type { Punto } from "./tipos.ts";

export type { Punto };

/** Distancia euclidiana entre dos puntos {x,y} en metros. */
export function distancia(p1: Punto, p2: Punto): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * Área de un polígono cerrado — fórmula del "shoelace" (estándar de la
 * industria, la misma que usa internamente cualquier GIS/CAD). `puntos`
 * es la lista ORDENADA de vértices (no hace falta repetir el primero al
 * final, el wraparound ya lo hace el módulo). Devuelve m².
 */
export function areaPoligono(puntos: Punto[]): number {
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
export function perimetroPoligono(puntos: Punto[]): number {
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
export function longitudPolilinea(puntos: Punto[]): number {
  if (!Array.isArray(puntos) || puntos.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < puntos.length - 1; i++) {
    total += distancia(puntos[i], puntos[i + 1]);
  }
  return total;
}

/**
 * Las 4 esquinas de un rectángulo de `anchoM`×`altoM`, centrado en
 * `centro` — en orden (da la vuelta), listo para pasarle directo a
 * crearHabitacion/areaPoligono/perimetroPoligono. Usado por el
 * "generador de ambiente por dimensión" (modules/plano/index.js,
 * crearHabitacionRectangular) — pedido explícito del usuario
 * (2026-11-20): escribir una etiqueta + un ancho×alto conocido y que
 * aparezca un polígono de ESE tamaño exacto, en vez de tener que
 * trazarlo a mano punto por punto.
 */
export function puntosRectangulo(centro: Punto, anchoM: number, altoM: number): Punto[] {
  const mitadAncho = anchoM / 2;
  const mitadAlto = altoM / 2;
  return [
    { x: centro.x - mitadAncho, y: centro.y - mitadAlto },
    { x: centro.x + mitadAncho, y: centro.y - mitadAlto },
    { x: centro.x + mitadAncho, y: centro.y + mitadAlto },
    { x: centro.x - mitadAncho, y: centro.y + mitadAlto },
  ];
}

/**
 * ¿`punto` cae DENTRO de `poligono` (lista de vértices, cerrado
 * implícito)? Ray casting estándar (cuenta cruces de una semirrecta
 * horizontal hacia +x) — usado para el "hit test" de arrastrar un
 * ambiente: al hacer click/touch, con qué habitación (si alguna)
 * coincide el punto.
 */
export function puntoDentroDePoligono(punto: Punto, poligono: Punto[]): boolean {
  if (!Array.isArray(poligono) || poligono.length < 3) return false;
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i];
    const b = poligono[j];
    const cruza = a.y > punto.y !== b.y > punto.y;
    if (cruza) {
      const xCruce = ((b.x - a.x) * (punto.y - a.y)) / (b.y - a.y) + a.x;
      if (punto.x < xCruce) dentro = !dentro;
    }
  }
  return dentro;
}

/**
 * Intersección de 2 círculos (centros + radios, en METROS) — núcleo de
 * la "triangulación por recorrido" (usuario, 2026-11-20): fijar un
 * punto nuevo del plano midiendo su distancia a 2 puntos YA conocidos
 * (dos esquinas, dos equipos ya ubicados), sin necesitar ángulo —
 * alcanza una cinta métrica. El punto recién fijado puede, a su vez,
 * servir de referencia para el siguiente — así se va "recorriendo" el
 * sitio en cadena, sin volver siempre a los mismos 2 puntos de
 * partida (ver agregarMarcadorEquipoPorTriangulacionPlano,
 * useCircuitos.js).
 *
 * Caso general: 2 soluciones, una a cada lado de la recta que une los
 * 2 centros — desambiguar cuál es la correcta (ej. con un click
 * aproximado del usuario) es decisión de quien llama, acá solo se
 * devuelven ambas. Tangentes (`radioA + radioB === d` o
 * `|radioA − radioB| === d`): 1 sola solución. Si las 2 distancias
 * ingresadas NO son compatibles con la separación real entre los 2
 * puntos de referencia (muy lejos para alcanzarse, o un círculo
 * adentro del otro) no hay intersección real — se devuelve []; nunca
 * se fuerza una solución aproximada con datos que no cierran, mismo
 * criterio de "nunca adivinar" del resto de la app.
 */
export function interseccionCirculos(centroA: Punto, radioA: number, centroB: Punto, radioB: number): Punto[] {
  const d = distancia(centroA, centroB);
  const EPSILON = 1e-9;
  if (d <= EPSILON) return []; // mismo punto de referencia dos veces — no hay cómo triangular
  if (d > radioA + radioB + EPSILON || d < Math.abs(radioA - radioB) - EPSILON) return [];

  const a = (radioA ** 2 - radioB ** 2 + d ** 2) / (2 * d);
  const hCuadrado = radioA ** 2 - a ** 2;
  const h = hCuadrado > EPSILON ? Math.sqrt(hCuadrado) : 0;
  const px = centroA.x + (a * (centroB.x - centroA.x)) / d;
  const py = centroA.y + (a * (centroB.y - centroA.y)) / d;
  if (h === 0) return [{ x: px, y: py }]; // tangentes — una sola solución

  const dx = (h * (centroB.y - centroA.y)) / d;
  const dy = (h * (centroB.x - centroA.x)) / d;
  return [
    { x: px + dx, y: py - dy },
    { x: px - dx, y: py + dy },
  ];
}

export {
  ZOOM_MIN,
  ZOOM_MAX,
  transformVistaInicial,
  aPantalla,
  aModelo,
  aplicarZoom,
  aplicarPan,
  ajustarAVentana,
} from "./vistaZoomPan.ts";
export type { TransformVista } from "./vistaZoomPan.ts";
