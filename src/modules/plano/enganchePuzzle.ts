// src/modules/plano/enganchePuzzle.ts
//
// Enganche automático de "Mover ambiente" — usuario, 2026-11-25,
// deuda técnica dejada a propósito al construir "plano sin imagen"
// v1 ("Sin enganche automático primero", confirmado por el usuario vía
// AskUserQuestion). Geométrico puro, cero React/canvas — mismo
// criterio que el resto de este módulo.
//
// ALCANCE: ambientes generados por "Generar ambiente"/"Trazar
// rectángulo" son siempre rectángulos alineados a los ejes (ver
// crearHabitacionRectangular) — por eso el enganche trabaja sobre la
// caja AABB (axis-aligned bounding box) de cada ambiente, no sobre un
// polígono arbitrario. Un ambiente trazado a mano (polígono irregular)
// sigue funcionando como ambiente, pero se engancha por su CAJA
// envolvente, una aproximación — no exacta para una forma no
// rectangular, documentado así a propósito en vez de fingir precisión
// que no hay.
//
// MECÁNICA: al arrastrar, cada eje (X e Y) se evalúa por separado
// contra los bordes de TODOS los demás ambientes + el marco del plano
// (los 4 lados de la imagen de fondo, real o sintética) — si el borde
// que se está moviendo (izquierdo o derecho en X; superior o inferior
// en Y) cae a menos de `radio` metros de un borde de referencia
// (propio o del de enfrente — ambos casos son "enganche": encajar lado
// a lado como piezas de rompecabezas, o alinear el mismo lado), se
// ajusta el delta de ESE eje para que quede EXACTO. Si hay varios
// candidatos dentro del radio, gana el que requiere el menor ajuste
// (el más cercano). Ningún eje se fuerza si no hay un candidato cerca
// — el arrastre libre de siempre sigue funcionando igual.
import type { Punto, NodoPlano, HabitacionPlano } from "./tipos.ts";

export interface CajaAABB {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** Caja envolvente de un ambiente, en espacio modelo (metros) — null si no se puede resolver ningún nodo (no debería pasar en uso normal). */
export function cajaDeHabitacion(habitacion: HabitacionPlano, nodos: NodoPlano[]): CajaAABB | null {
  const puntos = habitacion.nodoIds.map((id) => nodos.find((n) => n.id === id)?.punto).filter((p): p is Punto => Boolean(p));
  if (puntos.length === 0) return null;
  const xs = puntos.map((p) => p.x);
  const ys = puntos.map((p) => p.y);
  return { xMin: Math.min(...xs), xMax: Math.max(...xs), yMin: Math.min(...ys), yMax: Math.max(...ys) };
}

/**
 * Ajusta `deltaPropuesto` (el movimiento que se iba a aplicar) para que
 * enganche contra cualquier caja de `cajasReferencia` dentro de
 * `radio` metros, eje por eje. Devuelve un delta nuevo, nunca muta los
 * parámetros. Sin ningún candidato cerca, devuelve `deltaPropuesto` tal
 * cual (arrastre libre).
 */
export function calcularDeltaConEnganche(cajaActual: CajaAABB, deltaPropuesto: Punto, cajasReferencia: CajaAABB[], radio: number): Punto {
  const propuesta: CajaAABB = {
    xMin: cajaActual.xMin + deltaPropuesto.x,
    xMax: cajaActual.xMax + deltaPropuesto.x,
    yMin: cajaActual.yMin + deltaPropuesto.y,
    yMax: cajaActual.yMax + deltaPropuesto.y,
  };

  let mejorAjusteX: number | null = null;
  let mejorAjusteY: number | null = null;

  for (const ref of cajasReferencia) {
    for (const bordeX of [propuesta.xMin, propuesta.xMax]) {
      for (const bordeRefX of [ref.xMin, ref.xMax]) {
        const ajuste = bordeRefX - bordeX;
        if (Math.abs(ajuste) <= radio && (mejorAjusteX === null || Math.abs(ajuste) < Math.abs(mejorAjusteX))) {
          mejorAjusteX = ajuste;
        }
      }
    }
    for (const bordeY of [propuesta.yMin, propuesta.yMax]) {
      for (const bordeRefY of [ref.yMin, ref.yMax]) {
        const ajuste = bordeRefY - bordeY;
        if (Math.abs(ajuste) <= radio && (mejorAjusteY === null || Math.abs(ajuste) < Math.abs(mejorAjusteY))) {
          mejorAjusteY = ajuste;
        }
      }
    }
  }

  return {
    x: deltaPropuesto.x + (mejorAjusteX ?? 0),
    y: deltaPropuesto.y + (mejorAjusteY ?? 0),
  };
}
