// src/modules/plano/deteccionBordes.js
//
// Asistencia de bordes para el trazado de paredes — Fase 2 (2026-11-20),
// la versión "asistida" acordada con el usuario en vez del pipeline
// completo de visión por computadora (OpenCV.js + detección automática
// de todas las paredes), que el diseño ya había marcado como
// demasiado ambicioso para esta etapa. Acá NO se detectan paredes
// automáticamente — se ayuda a que el click del usuario, al trazar a
// mano, se "pegue" al borde más fuerte cercano (ej. el filo real de
// una pared en el escaneo), en vez de quedar un par de píxeles
// desalineado. El usuario sigue trazando, esto solo afina CADA click.
//
// Matemática pura: dado un parche de píxeles en escala de grises
// (Float32Array, fila por fila) de tamaño ancho×alto, calcula la
// magnitud de gradiente por píxel (operador Sobel 3×3 — el detector de
// bordes más simple y estándar, el mismo primer paso que usa
// internamente cualquier librería de visión por computadora) y
// encuentra el píxel de mayor magnitud dentro de un radio desde un
// punto central, si supera un umbral mínimo (si no hay ningún borde
// claro cerca, no sugiere nada — mejor no ajustar que ajustar mal).
//
// CERO DOM/canvas acá — leer los píxeles de la imagen es
// responsabilidad del componente de render (PlanoCanvas.jsx, que ya
// es el único que toca el DOM), este módulo solo recibe números.
// Módulo puro — se usa a través de PlanoMediator.

const SOBEL_X = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
const SOBEL_Y = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

/** Magnitud de gradiente (Sobel) por píxel de un parche en escala de grises. Bordes del parche quedan en 0 (sin vecinos completos). */
export function magnitudGradiente(grises, ancho, alto) {
  const magnitud = new Float32Array(ancho * alto);
  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      let gx = 0;
      let gy = 0;
      let k = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const v = grises[(y + dy) * ancho + (x + dx)];
          gx += v * SOBEL_X[k];
          gy += v * SOBEL_Y[k];
          k++;
        }
      }
      magnitud[y * ancho + x] = Math.hypot(gx, gy);
    }
  }
  return magnitud;
}

/**
 * Píxel con mayor magnitud de borde dentro de `radio` del punto
 * (centroX, centroY) — o `null` si ninguno supera `umbralMinimo` (no
 * hay nada que valga la pena sugerir, se usa el click tal cual vino).
 */
export function pixelBordeMasFuerte(grises, ancho, alto, centroX, centroY, radio, umbralMinimo) {
  const magnitud = magnitudGradiente(grises, ancho, alto);
  let mejor = null;
  let mejorMagnitud = umbralMinimo;
  const radio2 = radio * radio;

  const yDesde = Math.max(1, Math.round(centroY - radio));
  const yHasta = Math.min(alto - 1, Math.round(centroY + radio));
  const xDesde = Math.max(1, Math.round(centroX - radio));
  const xHasta = Math.min(ancho - 1, Math.round(centroX + radio));

  for (let y = yDesde; y < yHasta; y++) {
    for (let x = xDesde; x < xHasta; x++) {
      const dx = x - centroX;
      const dy = y - centroY;
      if (dx * dx + dy * dy > radio2) continue;
      const m = magnitud[y * ancho + x];
      if (m > mejorMagnitud) {
        mejorMagnitud = m;
        mejor = { x, y };
      }
    }
  }
  return mejor;
}

export const RADIO_BUSQUEDA_BORDE_PX = 14;
export const UMBRAL_MAGNITUD_BORDE = 60;
