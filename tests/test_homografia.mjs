import { calcularHomografia, aplicarHomografia, invertirMatriz3x3 } from "../src/modules/plano/homografia.ts";

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

function cerca(a, b, tol = 1e-6) {
  return Math.abs(a - b) < tol;
}

// Cuadrilátero genuinamente distorsionado (NO es un rectángulo) —
// simula las 4 esquinas de una habitación rectangular vistas con
// perspectiva desde una foto en ángulo.
const origen = [
  { x: 100, y: 60 },   // arriba-izq (más cerca de la cámara -> más abierto)
  { x: 520, y: 90 },   // arriba-der
  { x: 480, y: 420 },  // abajo-der
  { x: 140, y: 400 },  // abajo-izq
];

// Rectángulo ideal destino — 4m de ancho × 3m de alto, a 120px/m (igual
// constante que useCircuitos.js).
const PX_POR_METRO = 120;
const anchoPx = 4 * PX_POR_METRO;
const altoPx = 3 * PX_POR_METRO;
const destino = [
  { x: 0, y: 0 },
  { x: anchoPx, y: 0 },
  { x: anchoPx, y: altoPx },
  { x: 0, y: altoPx },
];

const H = calcularHomografia(origen, destino);
assert(H !== null, "calcularHomografia devuelve una matriz válida para un cuadrilátero genuinamente distorsionado");

// --- 1. Cada punto de origen debe mapear EXACTO a su correspondiente destino ---
for (let i = 0; i < 4; i++) {
  const mapeado = aplicarHomografia(H, origen[i]);
  assert(
    cerca(mapeado.x, destino[i].x, 1e-3) && cerca(mapeado.y, destino[i].y, 1e-3),
    `Punto de control ${i}: origen(${origen[i].x},${origen[i].y}) -> destino(${mapeado.x.toFixed(3)},${mapeado.y.toFixed(3)}), esperado (${destino[i].x},${destino[i].y})`
  );
}

// --- 2. La homografía NO debe ser una simple escala/traslación (debe tener componente proyectivo real) ---
assert(Math.abs(H[6]) > 1e-6 || Math.abs(H[7]) > 1e-6, "La matriz tiene componente proyectivo real (h31/h32 != 0) — confirma que es una homografía de verdad, no una transformación afín");

// --- 3. Round-trip: H inversa aplicada al resultado de H debe devolver el punto original ---
const Hinv = invertirMatriz3x3(H);
assert(Hinv !== null, "La matriz se puede invertir (no es singular)");

const puntoDePrueba = { x: 300, y: 250 }; // un punto arbitrario DENTRO del cuadrilátero origen, no uno de los 4 de control
const pasoAlDestino = aplicarHomografia(H, puntoDePrueba);
const vueltaAlOrigen = aplicarHomografia(Hinv, pasoAlDestino);
assert(
  cerca(vueltaAlOrigen.x, puntoDePrueba.x, 1e-2) && cerca(vueltaAlOrigen.y, puntoDePrueba.y, 1e-2),
  `Round-trip H⁻¹(H(p)) = p para un punto arbitrario (real: ${vueltaAlOrigen.x.toFixed(4)},${vueltaAlOrigen.y.toFixed(4)}, esperado: ${puntoDePrueba.x},${puntoDePrueba.y})`
);

// --- 4. Caso degenerado: 3 puntos colineales -> debe devolver null, NUNCA inventar un resultado ---
const origenDegenerado = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }, { x: 50, y: 100 }];
const Hdeg = calcularHomografia(origenDegenerado, destino);
assert(Hdeg === null, "Con 3 puntos colineales (cuadrilátero inválido), calcularHomografia devuelve null en vez de inventar una matriz");

console.log("\nListo.");
