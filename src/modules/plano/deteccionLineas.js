// src/modules/plano/deteccionLineas.js
//
// Asistencia MEJORADA de trazado (usuario, 2026-11-20, "reconocer
// perímetro, transecciones y segmentos del plano, paredes puertas
// vigas" — acordado en una versión acotada: "asistencia mejorada, no
// automático"). Esto NO reemplaza el trazado manual ni lo hace solo:
// detecta líneas RECTAS candidatas (paredes) a partir de los bordes de
// la imagen y las ofrece como sugerencias — el instalador las revisa
// una por una y confirma (clic) o las ignora. Nada se crea en el
// proyecto sin esa confirmación explícita.
//
// LIMITACIÓN DELIBERADA: solo detecta líneas AXIS-ALIGNED (horizontales
// o verticales en la imagen). Una pared diagonal no se sugiere —
// sigue necesitando trazado manual, igual que hoy. Se eligió este
// recorte a propósito: la gran mayoría de los planos (a mano o CAD)
// son ortogonales, y un detector de líneas en CUALQUIER ángulo
// (transformada de Hough general) es mucho más caro y propenso a
// falsos positivos — mismo criterio que ya se usó para descartar el
// pipeline completo de visión por computadora (ver deteccionBordes.js):
// una versión más chica y confiable antes que una más grande e incierta.
//
// MÉTODO: perfil de magnitud de gradiente (Sobel, ya existente en
// deteccionBordes.js) sumado por fila y por columna — una pared
// horizontal/vertical real produce un pico sostenido en ese perfil
// (muchos píxeles de borde alineados en la misma fila/columna), a
// diferencia del ruido disperso del resto de la imagen. De cada pico,
// se recorre esa fila/columna buscando TRAMOS contiguos de borde
// fuerte (con huecos chicos puenteados, ruido de escaneo/compresión) —
// cada tramo es una pared candidata. Un hueco ENTRE dos tramos de la
// MISMA línea, de ancho plausible para una puerta (si ya hay escala
// calibrada — sin escala no se puede juzgar "plausible", no se
// adivina), se marca como puerta candidata — puramente informativo,
// no es una entidad propia del proyecto todavía.
//
// Módulo puro — se usa a través de PlanoMediator. CERO DOM/canvas acá,
// igual criterio que deteccionBordes.js: leer los píxeles reales es
// responsabilidad de PlanoCanvas.jsx.

import { magnitudGradiente } from "./deteccionBordes.js";

export const UMBRAL_RELATIVO_PICO = 0.5; // una fila/columna es "candidata" si su suma de magnitud es >= 50% del máximo de todas
export const UMBRAL_PIXEL_BORDE = 35; // un píxel individual cuenta como "borde fuerte" si supera esto
export const BRECHA_MAXIMA_RUIDO_PX = 4; // huecos de hasta esto se puentean (ruido), no se consideran un corte real
export const LARGO_MINIMO_TRAMO_PX = 20; // un tramo más corto que esto no se sugiere (ruido disperso, no una pared)
export const PUERTA_ANCHO_MIN_M = 0.5;
export const PUERTA_ANCHO_MAX_M = 1.3;

/** Suma de magnitud de gradiente por fila — un pico sostenido indica una línea horizontal real. */
export function perfilFilas(magnitud, ancho, alto) {
  const perfil = new Float64Array(alto);
  for (let y = 0; y < alto; y++) {
    let suma = 0;
    for (let x = 0; x < ancho; x++) suma += magnitud[y * ancho + x];
    perfil[y] = suma;
  }
  return perfil;
}

/** Igual que perfilFilas, por columna — para líneas verticales. */
export function perfilColumnas(magnitud, ancho, alto) {
  const perfil = new Float64Array(ancho);
  for (let x = 0; x < ancho; x++) {
    let suma = 0;
    for (let y = 0; y < alto; y++) suma += magnitud[y * ancho + x];
    perfil[x] = suma;
  }
  return perfil;
}

// Una línea de 1px de ancho en la imagen produce gradiente Sobel
// FUERTE en las filas/columnas INMEDIATAS a cada lado de ella (el
// contraste real está ahí), pero débil/nulo justo ENCIMA de la línea
// (simétrica hacia ambos lados — no hay gradiente neto) — así que el
// pico del perfil queda partido en 2 rachas vecinas, no una sola. Se
// puentean con la misma tolerancia chica que tramosEnLinea (ruido de
// muestreo, no 2 líneas reales separadas).
const BRECHA_MAXIMA_PICO_PX = 3;

/**
 * Índices donde `perfil` supera `umbralRelativo` × su máximo, agrupados
 * en rachas contiguas (con huecos chicos puenteados, ver nota arriba) —
 * devuelve el CENTRO (redondeado) de cada racha, una por línea
 * candidata. Perfil todo en cero (imagen sin bordes, ej. un lienzo
 * vacío) devuelve [] — no se inventa un pico.
 */
export function picosDelPerfil(perfil, umbralRelativo = UMBRAL_RELATIVO_PICO) {
  let maximo = 0;
  for (let i = 0; i < perfil.length; i++) if (perfil[i] > maximo) maximo = perfil[i];
  if (maximo <= 0) return [];

  const umbral = maximo * umbralRelativo;
  const crudas = [];
  let inicio = null;
  for (let i = 0; i < perfil.length; i++) {
    if (perfil[i] >= umbral) {
      if (inicio === null) inicio = i;
    } else if (inicio !== null) {
      crudas.push({ inicio, fin: i - 1 });
      inicio = null;
    }
  }
  if (inicio !== null) crudas.push({ inicio, fin: perfil.length - 1 });

  const rachas = [];
  for (const racha of crudas) {
    const anterior = rachas[rachas.length - 1];
    if (anterior && racha.inicio - anterior.fin - 1 <= BRECHA_MAXIMA_PICO_PX) {
      anterior.fin = racha.fin;
    } else {
      rachas.push({ ...racha });
    }
  }

  // El VALOR más alto dentro de la racha (no su centro geométrico): una
  // línea de 1px dibuja el pico real a los DOS lados de ella (ver nota
  // arriba) — el centro geométrico de la racha fusionada puede caer
  // justo ENCIMA de la línea, que es un valle de gradiente casi nulo,
  // no el borde fuerte que sí hace falta para extraer tramos después.
  return rachas.map((r) => {
    let mejorIndice = r.inicio;
    let mejorValor = perfil[r.inicio];
    for (let i = r.inicio + 1; i <= r.fin; i++) {
      if (perfil[i] > mejorValor) {
        mejorValor = perfil[i];
        mejorIndice = i;
      }
    }
    return mejorIndice;
  });
}

/**
 * Tramos contiguos de `valores` (magnitud a lo largo de una fila/columna
 * ya extraída) donde el valor supera UMBRAL_PIXEL_BORDE — huecos de
 * hasta BRECHA_MAXIMA_RUIDO_PX se puentean (se consideran parte del
 * mismo tramo, ruido de escaneo), tramos más cortos que
 * LARGO_MINIMO_TRAMO_PX se descartan (ruido disperso).
 */
export function tramosEnLinea(valores) {
  const crudos = [];
  let inicio = null;
  for (let i = 0; i < valores.length; i++) {
    const activo = valores[i] >= UMBRAL_PIXEL_BORDE;
    if (activo) {
      if (inicio === null) inicio = i;
    } else if (inicio !== null) {
      crudos.push({ inicio, fin: i - 1 });
      inicio = null;
    }
  }
  if (inicio !== null) crudos.push({ inicio, fin: valores.length - 1 });

  // Puentea huecos chicos entre tramos consecutivos (ruido, no un corte real).
  const puenteados = [];
  for (const tramo of crudos) {
    const anterior = puenteados[puenteados.length - 1];
    if (anterior && tramo.inicio - anterior.fin - 1 <= BRECHA_MAXIMA_RUIDO_PX) {
      anterior.fin = tramo.fin;
    } else {
      puenteados.push({ ...tramo });
    }
  }

  return puenteados.filter((t) => t.fin - t.inicio + 1 >= LARGO_MINIMO_TRAMO_PX);
}

/**
 * Detecta paredes candidatas (horizontales + verticales) y, si hay
 * escala calibrada, huecos entre tramos de la MISMA línea con ancho
 * plausible de puerta — puramente informativo, nada se crea solo.
 *
 * @param {Float32Array|number[]} grises - imagen completa en escala de grises, fila por fila
 * @param {number} ancho
 * @param {number} alto
 * @param {{escalaMetrosPorPixel?: number}} [opciones]
 * @returns {{paredes: {x1,y1,x2,y2,orientacion}[], puertas: {x1,y1,x2,y2,orientacion}[]}}
 */
export function detectarParedesCandidatas(grises, ancho, alto, opciones = {}) {
  const magnitud = magnitudGradiente(grises, ancho, alto);
  const paredes = [];
  const puertas = [];

  const anchoPuertaMinPx = opciones.escalaMetrosPorPixel ? PUERTA_ANCHO_MIN_M / opciones.escalaMetrosPorPixel : null;
  const anchoPuertaMaxPx = opciones.escalaMetrosPorPixel ? PUERTA_ANCHO_MAX_M / opciones.escalaMetrosPorPixel : null;

  function registrarPuertasEntreTramos(tramos, aPunto) {
    if (anchoPuertaMinPx == null) return; // sin calibrar, no se puede juzgar "plausible" — no se adivina
    for (let i = 1; i < tramos.length; i++) {
      const huecoPx = tramos[i].inicio - tramos[i - 1].fin - 1;
      if (huecoPx >= anchoPuertaMinPx && huecoPx <= anchoPuertaMaxPx) {
        const p1 = aPunto(tramos[i - 1].fin + 1);
        const p2 = aPunto(tramos[i].inicio - 1);
        puertas.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, orientacion: p1.y === p2.y ? "horizontal" : "vertical" });
      }
    }
  }

  const filasPico = picosDelPerfil(perfilFilas(magnitud, ancho, alto));
  for (const y of filasPico) {
    const valores = new Float64Array(ancho);
    for (let x = 0; x < ancho; x++) valores[x] = magnitud[y * ancho + x];
    const tramos = tramosEnLinea(valores);
    for (const t of tramos) paredes.push({ x1: t.inicio, y1: y, x2: t.fin, y2: y, orientacion: "horizontal" });
    registrarPuertasEntreTramos(tramos, (x) => ({ x, y }));
  }

  const columnasPico = picosDelPerfil(perfilColumnas(magnitud, ancho, alto));
  for (const x of columnasPico) {
    const valores = new Float64Array(alto);
    for (let y = 0; y < alto; y++) valores[y] = magnitud[y * ancho + x];
    const tramos = tramosEnLinea(valores);
    for (const t of tramos) paredes.push({ x1: x, y1: t.inicio, x2: x, y2: t.fin, orientacion: "vertical" });
    registrarPuertasEntreTramos(tramos, (y) => ({ x, y }));
  }

  return { paredes, puertas };
}
