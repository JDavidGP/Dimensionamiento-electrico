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

/**
 * Intersección de 2 segmentos (no rectas infinitas) — usuario,
 * 2026-11-22, "motor geométrico" para el cruce de una ruta de
 * conductor contra las paredes del plano (ver
 * modules/plano/cruceParedes.ts). Algoritmo paramétrico estándar:
 * resuelve p1+t·(p2−p1) = p3+u·(p4−p3) para t,u ∈ [0,1] — si ambos
 * caen en ese rango, los segmentos se cruzan DENTRO de sus propios
 * extremos (no solo sus rectas extendidas).
 *
 * `null` si son paralelos (denominador ≈0, incluye el caso colineal —
 * no hay un único punto de cruce que devolver) o si se cruzan fuera de
 * alguno de los 2 segmentos.
 */
export function interseccionSegmentos(p1: Punto, p2: Punto, p3: Punto, p4: Punto): Punto | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  const EPSILON = 1e-9;
  if (Math.abs(denom) < EPSILON) return null;

  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;

  return { x: p1.x + t * d1x, y: p1.y + t * d1y };
}

/**
 * Ángulo AGUDO (0 a 90°, en RADIANES) entre las direcciones de 2
 * segmentos — usado para la "distancia inclinada" al atravesar una
 * capa de espesor conocido en diagonal (ver cruceParedes.ts): agudo a
 * propósito, porque cruzar una pared en 30° o en 150° atraviesa
 * exactamente el mismo espesor real (el ángulo obtuso es el mismo
 * cruce visto "del otro lado"). `0` si algún segmento tiene longitud
 * cero (no tiene dirección que medir).
 */
export function anguloAgudoEntreSegmentos(p1: Punto, p2: Punto, p3: Punto, p4: Punto): number {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;
  const mag1 = Math.hypot(d1x, d1y);
  const mag2 = Math.hypot(d2x, d2y);
  if (mag1 === 0 || mag2 === 0) return 0;

  const cosTheta = Math.max(-1, Math.min(1, (d1x * d2x + d1y * d2y) / (mag1 * mag2)));
  const theta = Math.acos(cosTheta);
  return theta > Math.PI / 2 ? Math.PI - theta : theta;
}

// Snap de ángulo al trazar pared/conductor — usuario, 2026-11-25/26
// ("¿cómo tener trazos más limpios?"): sin esto, nada ayuda a que una
// pared salga perfectamente horizontal/vertical/45° al trazar a mano,
// causa típica de que quede ligeramente torcida. Mismo criterio que
// ajustarABorde en PlanoCanvas.jsx (una AYUDA opcional al trazado
// manual, nunca una corrección forzada): si el ángulo real ya está
// LEJOS del múltiplo más cercano (más de `toleranciaGrados`), el punto
// vuelve sin tocar — nunca "tira" de un trazo que el instalador quiso
// en diagonal a propósito.
/** Incremento de ángulo al que se intenta "pegar" un trazo — 15° cubre horizontal/vertical/diagonales comunes (0/15/30/45/60/75/90...). */
export const SNAP_ANGULO_INCREMENTO_GRADOS = 15;
/** Si el ángulo real difiere del múltiplo más cercano por más de esto, no se snapea — se respeta el trazo tal cual. */
export const SNAP_ANGULO_TOLERANCIA_GRADOS = 6;

/**
 * Punto ajustado para que el ángulo del segmento `origen->punto` caiga
 * en el múltiplo más cercano de `incrementoGrados`, SI la diferencia
 * real está dentro de `toleranciaGrados` (si no, devuelve `punto` tal
 * cual). La DISTANCIA origen->punto nunca cambia, solo la dirección —
 * mismo radio, ángulo corregido.
 */
export function puntoConAnguloSnapeado(
  origen: Punto,
  punto: Punto,
  incrementoGrados: number = SNAP_ANGULO_INCREMENTO_GRADOS,
  toleranciaGrados: number = SNAP_ANGULO_TOLERANCIA_GRADOS
): Punto {
  const dx = punto.x - origen.x;
  const dy = punto.y - origen.y;
  const distanciaTramo = Math.hypot(dx, dy);
  if (distanciaTramo === 0) return punto;

  const anguloGrados = (Math.atan2(dy, dx) * 180) / Math.PI;
  const anguloRedondeado = Math.round(anguloGrados / incrementoGrados) * incrementoGrados;
  if (Math.abs(anguloGrados - anguloRedondeado) > toleranciaGrados) return punto;

  const anguloRad = (anguloRedondeado * Math.PI) / 180;
  return { x: origen.x + distanciaTramo * Math.cos(anguloRad), y: origen.y + distanciaTramo * Math.sin(anguloRad) };
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
