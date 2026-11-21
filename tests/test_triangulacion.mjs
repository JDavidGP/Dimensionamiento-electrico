// Triangulación por recorrido (usuario, 2026-11-21): fijar un punto
// nuevo con 2 distancias medidas desde 2 puntos YA conocidos del
// plano. Prueba la matemática pura (intersección de 2 círculos) con
// casos conocidos de antemano (triángulos 3-4-5, tangencia, sin
// solución), antes de tocar la UI.
import { ApplicationMediator as App } from "../src/core/ApplicationMediator.js";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

function cercaDe(valor, esperado, tolerancia = 1e-6) {
  return Math.abs(valor - esperado) < tolerancia;
}

// --- 1. Triángulo 3-4-5: referencias en (0,0) y (4,0), radios 3 y 5 -> el punto (0,3) o (0,-3) ---
const sol1 = App.plano.interseccionCirculos({ x: 0, y: 0 }, 3, { x: 4, y: 0 }, 5);
assert(sol1.length === 2, `3-4-5 da 2 soluciones (real: ${sol1.length})`);
if (sol1.length === 2) {
  const tieneArriba = sol1.some((p) => cercaDe(p.x, 0) && cercaDe(p.y, 3));
  const tieneAbajo = sol1.some((p) => cercaDe(p.x, 0) && cercaDe(p.y, -3));
  assert(tieneArriba && tieneAbajo, `Las 2 soluciones son (0,3) y (0,-3) (real: ${JSON.stringify(sol1)})`);
}

// --- 2. Tangentes: círculos que se tocan en un solo punto ---
const sol2 = App.plano.interseccionCirculos({ x: 0, y: 0 }, 3, { x: 10, y: 0 }, 7);
assert(sol2.length === 1, `Tangencia externa da 1 sola solución (real: ${sol2.length})`);
if (sol2.length === 1) assert(cercaDe(sol2[0].x, 3) && cercaDe(sol2[0].y, 0), `El punto tangente es (3,0) (real: ${JSON.stringify(sol2[0])})`);

// --- 3. Sin solución: las 2 distancias no alcanzan a cruzarse (demasiado lejos) ---
const sol3 = App.plano.interseccionCirculos({ x: 0, y: 0 }, 2, { x: 20, y: 0 }, 2);
assert(sol3.length === 0, `Círculos demasiado separados: sin solución (real: ${sol3.length})`);

// --- 4. Sin solución: un círculo totalmente adentro del otro (radios muy dispares) ---
const sol4 = App.plano.interseccionCirculos({ x: 0, y: 0 }, 10, { x: 1, y: 0 }, 2);
assert(sol4.length === 0, `Un círculo adentro del otro: sin solución (real: ${sol4.length})`);

// --- 5. Mismo punto de referencia 2 veces: no se puede triangular ---
const sol5 = App.plano.interseccionCirculos({ x: 5, y: 5 }, 3, { x: 5, y: 5 }, 4);
assert(sol5.length === 0, `2 referencias idénticas: sin solución (real: ${sol5.length})`);

console.log("\nTodas las pruebas completadas.");
