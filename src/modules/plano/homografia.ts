// src/modules/plano/homografia.ts
//
// Corrección de perspectiva — Fase 2, segunda ronda (2026-11-20). Ver
// PLANO_INTELIGENTE_DISENO.md §5: una foto tomada con cámara rara vez
// es perpendicular al plano, así que un escalar único (metros por
// píxel igual en cualquier dirección) es matemáticamente incorrecto
// — un punto lejos de la cámara mide distinto por píxel que uno
// cerca. La solución estándar (la misma que usan las apps de "escanear
// documento" para aplanar una foto) es resolver una HOMOGRAFÍA: una
// matriz 3×3 proyectiva que mapea 4 puntos de la foto (las esquinas de
// un rectángulo real conocido) a un rectángulo ideal, y usarla para
// "enderezar" la foto completa antes de calibrar la escala.
//
// DLT = "Direct Linear Transform" — el método estándar de visión por
// computadora para resolver una homografía a partir de 4 (o más)
// correspondencias de puntos. Es álgebra lineal pura (un sistema de 8
// ecuaciones con 8 incógnitas, resuelto acá con eliminación de
// Gauss-Jordan con pivoteo parcial) — no hace falta ninguna librería
// de CV para esto, a diferencia de la detección automática de bordes/
// paredes que sí la necesitaría.
//
// Módulo puro — cero DOM/canvas (eso es shared/utils/rectificarImagen.ts,
// que aplica la matriz que este módulo calcula). Se usa a través de
// PlanoMediator.

import type { Punto } from "./tipos.ts";

/**
 * Resuelve un sistema lineal Ax=b por eliminación de Gauss-Jordan con
 * pivoteo parcial. `A` es una matriz n×n (array de arrays), `b` un
 * vector de n. Devuelve x (array de n) o `null` si el sistema es
 * singular (los 4 puntos de origen o destino son degenerados — ej.
 * tres de ellos alineados).
 */
function resolverSistemaLineal(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = A.map((fila, i) => [...fila, b[i]]);

  for (let col = 0; col < n; col++) {
    let filaPivote = col;
    let mayor = Math.abs(m[col][col]);
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r][col]) > mayor) {
        mayor = Math.abs(m[r][col]);
        filaPivote = r;
      }
    }
    if (mayor < 1e-9) return null;
    [m[col], m[filaPivote]] = [m[filaPivote], m[col]];

    const pivote = m[col][col];
    for (let c = col; c <= n; c++) m[col][c] /= pivote;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = m[r][col];
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) m[r][c] -= factor * m[col][c];
    }
  }

  return m.map((fila) => fila[n]);
}

/**
 * Calcula la matriz de homografía 3×3 (9 números, fila por fila, con
 * h33=1) que mapea los 4 puntos de `origen` a los 4 de `destino`, en
 * el MISMO orden (origen[i] ↔ destino[i]). Devuelve `null` si los
 * puntos son degenerados (ej. 3 colineales) — nunca inventa un
 * resultado sobre datos que no lo permiten.
 *
 * @param origen - 4 puntos, en espacio imagen (la foto tal cual)
 * @param destino - 4 puntos, el rectángulo ideal al que deben mapear
 * @returns matriz 3×3 fila por fila: [h11,h12,h13,h21,h22,h23,h31,h32,h33]
 */
export function calcularHomografia(origen: Punto[], destino: Punto[]): number[] | null {
  if (origen?.length !== 4 || destino?.length !== 4) return null;

  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = origen[i];
    const { x: u, y: v } = destino[i];
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    b.push(v);
  }

  const h = resolverSistemaLineal(A, b);
  if (!h) return null;
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/** Aplica una homografía 3×3 a un punto (división homogénea incluida). `null` si el punto cae en el infinito. */
export function aplicarHomografia(m: number[], punto: Punto): Punto | null {
  const w = m[6] * punto.x + m[7] * punto.y + m[8];
  if (Math.abs(w) < 1e-9) return null;
  return {
    x: (m[0] * punto.x + m[1] * punto.y + m[2]) / w,
    y: (m[3] * punto.x + m[4] * punto.y + m[5]) / w,
  };
}

/** Inversa de una matriz 3×3 (fila por fila) — `null` si es singular (determinante ≈ 0). */
export function invertirMatriz3x3(m: number[]): number[] | null {
  const [a, b, c, d, e, f, g, h, i] = m;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-12) return null;
  const invDet = 1 / det;
  return [
    (e * i - f * h) * invDet, (c * h - b * i) * invDet, (b * f - c * e) * invDet,
    (f * g - d * i) * invDet, (a * i - c * g) * invDet, (c * d - a * f) * invDet,
    (d * h - e * g) * invDet, (b * g - a * h) * invDet, (a * e - b * d) * invDet,
  ];
}
