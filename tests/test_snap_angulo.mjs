// Snap de ángulo al trazar pared/conductor — usuario, 2026-11-25/26,
// "¿cómo tener trazos más limpios?" (sin esto, nada ayudaba a que una
// pared saliera perfectamente horizontal/vertical/diagonal al trazar a
// mano). Prueba la capa PURA: puntoConAnguloSnapeado
// (modules/geometria/index.ts).
import { puntoConAnguloSnapeado, distancia, SNAP_ANGULO_INCREMENTO_GRADOS, SNAP_ANGULO_TOLERANCIA_GRADOS } from "../src/modules/geometria/index.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

function cercaDe(a, b, eps = 1e-9) {
  return Math.abs(a - b) < eps;
}

const origen = { x: 0, y: 0 };

// --- 1. Ángulo YA exacto (0°) -> el punto no cambia ---
const exacto0 = puntoConAnguloSnapeado(origen, { x: 5, y: 0 });
assert(cercaDe(exacto0.x, 5) && cercaDe(exacto0.y, 0), `Ángulo ya exacto (0°) -> sin cambio (real: ${JSON.stringify(exacto0)})`);

// --- 2. Ángulo DENTRO de tolerancia (3°, tolerancia default 6°) -> snapea a 0° exacto, MISMA distancia ---
const anguloCercaDeCero = (3 * Math.PI) / 180;
const puntoCercaDeCero = { x: 5 * Math.cos(anguloCercaDeCero), y: 5 * Math.sin(anguloCercaDeCero) };
const snapCercaDeCero = puntoConAnguloSnapeado(origen, puntoCercaDeCero);
assert(cercaDe(snapCercaDeCero.x, 5, 1e-6) && cercaDe(snapCercaDeCero.y, 0, 1e-6), `3° de desvío (dentro de tolerancia) -> snapea a 0° exacto (real: ${JSON.stringify(snapCercaDeCero)})`);
assert(cercaDe(distancia(origen, snapCercaDeCero), distancia(origen, puntoCercaDeCero), 1e-9), "La distancia NO cambia al snapear — solo la dirección");

// --- 3. Ángulo FUERA de tolerancia (7.5°, el punto medio exacto entre 0° y 15° — más lejos de cualquier múltiplo de lo que permite la tolerancia de 6°) -> no se toca ---
const angulo75 = (7.5 * Math.PI) / 180;
const punto75 = { x: 5 * Math.cos(angulo75), y: 5 * Math.sin(angulo75) };
const sinSnap75 = puntoConAnguloSnapeado(origen, punto75);
assert(cercaDe(sinSnap75.x, punto75.x) && cercaDe(sinSnap75.y, punto75.y), "7.5° de desvío (el punto medio entre 0° y 15°, fuera de la tolerancia de 6°) -> el punto queda tal cual, sin forzar nada");

// --- 4. Snapea a 45° (diagonal), no solo a 0°/90° ---
const angulo44 = (44 * Math.PI) / 180; // a 1° de 45°, dentro de tolerancia
const punto44 = { x: 5 * Math.cos(angulo44), y: 5 * Math.sin(angulo44) };
const snap45 = puntoConAnguloSnapeado(origen, punto44);
const anguloResultante = (Math.atan2(snap45.y, snap45.x) * 180) / Math.PI;
assert(cercaDe(anguloResultante, 45, 1e-6), `Snapea a 45° (diagonal), no solo a múltiplos de 90° (real: ${anguloResultante}°)`);

// --- 5. Funciona en los 4 cuadrantes (90°, 120°, -90°) — se evita el
// propio 180°/-180° a propósito: es el mismo ángulo representado con
// 2 signos opuestos (el "corte" de atan2), una ambigüedad de
// representación, no un bug de snapeo. ---
for (const anguloObjetivo of [90, 120, -90]) {
  const anguloConDesvio = ((anguloObjetivo + 2) * Math.PI) / 180; // 2° de desvío, dentro de tolerancia
  const puntoConDesvio = { x: 3 * Math.cos(anguloConDesvio), y: 3 * Math.sin(anguloConDesvio) };
  const snapResultado = puntoConAnguloSnapeado(origen, puntoConDesvio);
  const anguloFinal = (Math.atan2(snapResultado.y, snapResultado.x) * 180) / Math.PI;
  assert(cercaDe(anguloFinal, anguloObjetivo, 1e-6), `Snapea correctamente a ${anguloObjetivo}° (real: ${anguloFinal}°)`);
}

// --- 6. Origen === punto (distancia 0) -> devuelve el punto tal cual, sin NaN ---
const sinMovimiento = puntoConAnguloSnapeado(origen, { x: 0, y: 0 });
assert(sinMovimiento.x === 0 && sinMovimiento.y === 0 && !Number.isNaN(sinMovimiento.x), "Origen === punto (distancia 0) -> sin NaN, devuelve el punto tal cual");

// --- 7. Parámetros propios (incremento/tolerancia) se respetan, no solo los defaults ---
const anguloA20 = (20 * Math.PI) / 180;
const puntoA20 = { x: 5 * Math.cos(anguloA20), y: 5 * Math.sin(anguloA20) };
// Con incremento 10° y tolerancia amplia (15°), 20° es MÚLTIPLO exacto de 10 -> no debería moverse.
const conIncrementoPropio = puntoConAnguloSnapeado(origen, puntoA20, 10, 15);
assert(cercaDe(conIncrementoPropio.x, puntoA20.x, 1e-6) && cercaDe(conIncrementoPropio.y, puntoA20.y, 1e-6), "Con incrementoGrados=10, un ángulo de 20° (múltiplo exacto) no se mueve");
// Con tolerancia muy chica (1°), el mismo 3° de desvío del caso 2 YA NO debería snapear.
const conToleranciaChica = puntoConAnguloSnapeado(origen, puntoCercaDeCero, SNAP_ANGULO_INCREMENTO_GRADOS, 1);
assert(cercaDe(conToleranciaChica.x, puntoCercaDeCero.x, 1e-6), `Con toleranciaGrados=1, un desvío de 3° ya NO snapea (real: ${JSON.stringify(conToleranciaChica)})`);

// --- 8. Constantes por defecto tienen los valores documentados ---
assert(SNAP_ANGULO_INCREMENTO_GRADOS === 15, "SNAP_ANGULO_INCREMENTO_GRADOS = 15°");
assert(SNAP_ANGULO_TOLERANCIA_GRADOS === 6, "SNAP_ANGULO_TOLERANCIA_GRADOS = 6°");

console.log("\nTodas las pruebas completadas.");
