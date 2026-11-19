// Utilidades puras para la UI de asignación de líneas (L1/L2/L3) —
// circuito.lineas y tablero.lineasAlimentador comparten el mismo
// concepto (a qué línea del tablero que lo alimenta está conectado),
// solo que en dos niveles distintos (circuito↔su tablero, subtablero↔su
// padre). Cero React, cero import de UI — se prueba con Node puro.

/** Líneas que tiene un tablero según sus fases ("mono"→1, "bi"→2, "tri"→3). */
export function lineasDisponiblesDeTablero(fasesTablero) {
  if (fasesTablero === "tri") return ["L1", "L2", "L3"];
  if (fasesTablero === "bi") return ["L1", "L2"];
  if (fasesTablero === "mono") return ["L1"];
  return [];
}

/**
 * Cuántas de esas líneas disponibles debe usar algo con `fasesPropias`
 * ("mono"→1, "bi"→2, "tri"→todas las que haya). Nunca más que las
 * disponibles (ej. un tri colgado por error de un tablero bi usa las 2
 * que hay, no inventa una tercera).
 */
export function lineasRequeridas(fasesPropias, disponibles) {
  if (fasesPropias === "tri") return disponibles.length;
  if (fasesPropias === "bi") return Math.min(2, disponibles.length);
  return Math.min(1, disponibles.length);
}

/**
 * Siguiente selección al hacer click en `linea`, dado el estado actual
 * `actuales` y cuántas se requieren (`requeridas`):
 *   - Si ya estaba seleccionada, se quita (toggle normal).
 *   - Si no estaba y falta alcanzar `requeridas`, se agrega.
 *   - Si no estaba y ya se alcanzó `requeridas`:
 *       - con requeridas=1 (mono) se comporta como radio: reemplaza la
 *         única selección por la nueva.
 *       - con requeridas>1 (bi/tri) no hace nada — el instalador debe
 *         quitar una antes de agregar otra (evita que un click deje en
 *         silencio una cantidad incorrecta de líneas).
 */
export function siguienteSeleccionLineas(actuales, linea, requeridas) {
  const yaSeleccionada = actuales.includes(linea);
  if (yaSeleccionada) {
    return actuales.filter((l) => l !== linea);
  }
  if (actuales.length < requeridas) {
    return [...actuales, linea];
  }
  if (requeridas === 1) {
    return [linea];
  }
  return actuales; // sin cambios — ya está al máximo
}
