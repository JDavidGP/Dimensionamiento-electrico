// Detección de líneas candidatas (paredes) + huecos candidatos a
// puerta (usuario, 2026-11-20) — probado con una imagen SINTÉTICA
// (un array de grises armado a mano, no un archivo), para conocer
// exactamente dónde "debería" encontrar cada línea.
import { ApplicationMediator as App } from "../src/core/ApplicationMediator.js";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

const ANCHO = 200;
const ALTO = 150;

function lienzoBlanco() {
  return new Float32Array(ANCHO * ALTO).fill(255);
}

function trazarLineaHorizontal(grises, y, x1, x2) {
  for (let x = x1; x <= x2; x++) grises[y * ANCHO + x] = 0;
}
function trazarLineaVertical(grises, x, y1, y2) {
  for (let y = y1; y <= y2; y++) grises[y * ANCHO + x] = 0;
}

// --- 1. Un cuadrado simple: 4 líneas finas (1px), sin puertas ---
const cuadrado = lienzoBlanco();
trazarLineaHorizontal(cuadrado, 20, 10, 190);
trazarLineaHorizontal(cuadrado, 130, 10, 190);
trazarLineaVertical(cuadrado, 10, 20, 130);
trazarLineaVertical(cuadrado, 190, 20, 130);

const r1 = App.plano.detectarParedesCandidatas(cuadrado, ANCHO, ALTO);
assert(r1.paredes.length === 4, `Encuentra las 4 líneas del cuadrado (real: ${r1.paredes.length})`);
const horizontales = r1.paredes.filter((p) => p.orientacion === "horizontal");
const verticales = r1.paredes.filter((p) => p.orientacion === "vertical");
assert(horizontales.length === 2 && verticales.length === 2, "2 horizontales + 2 verticales");
assert(horizontales.some((p) => Math.abs(p.y1 - 20) <= 1), "Una horizontal cerca de y=20");
assert(horizontales.some((p) => Math.abs(p.y1 - 130) <= 1), "Otra horizontal cerca de y=130");
assert(verticales.some((p) => Math.abs(p.x1 - 10) <= 1), "Una vertical cerca de x=10");
assert(verticales.some((p) => Math.abs(p.x1 - 190) <= 1), "Otra vertical cerca de x=190");
assert(r1.puertas.length === 0, "Sin escala calibrada, no se sugiere ninguna puerta (no se puede juzgar 'ancho plausible')");

// --- 2. Imagen en blanco (sin ninguna línea): no encuentra nada, no explota ---
const vacio = lienzoBlanco();
const r2 = App.plano.detectarParedesCandidatas(vacio, ANCHO, ALTO);
assert(r2.paredes.length === 0 && r2.puertas.length === 0, "Imagen sin bordes: no sugiere nada (no inventa una pared)");

// --- 3. Una pared vertical con un hueco (puerta) en el medio ---
const conPuerta = lienzoBlanco();
trazarLineaVertical(conPuerta, 50, 10, 60); // tramo de arriba
trazarLineaVertical(conPuerta, 50, 91, 140); // tramo de abajo (hueco DIBUJADO de 30px — el detectado es un poco menor por el efecto de borde de ±1-2px, se deja margen a propósito)
const r3 = App.plano.detectarParedesCandidatas(conPuerta, ANCHO, ALTO, { escalaMetrosPorPixel: 0.03 });
const verticalesConPuerta = r3.paredes.filter((p) => p.orientacion === "vertical" && Math.abs(p.x1 - 50) <= 1);
assert(verticalesConPuerta.length === 2, `El hueco separa la línea en 2 tramos (real: ${verticalesConPuerta.length})`);
assert(r3.puertas.length === 1, `Con escala calibrada, el hueco de ancho plausible se sugiere como puerta candidata (real: ${r3.puertas.length})`);
if (r3.puertas.length === 1) {
  const anchoHuecoM = Math.abs(r3.puertas[0].y2 - r3.puertas[0].y1) * 0.03;
  assert(anchoHuecoM >= 0.5 && anchoHuecoM <= 1.3, `El ancho de la puerta candidata cae dentro del rango plausible (real: ${anchoHuecoM.toFixed(2)}m)`);
}

// --- 4. Mismo hueco, pero DEMASIADO chico para ser puerta (ruido) ---
const huecoRuido = lienzoBlanco();
trazarLineaVertical(huecoRuido, 50, 10, 60);
trazarLineaVertical(huecoRuido, 50, 63, 140); // hueco de solo 2px -> se puentea como ruido, queda UNA sola línea
const r4 = App.plano.detectarParedesCandidatas(huecoRuido, ANCHO, ALTO, { escalaMetrosPorPixel: 0.03 });
const verticalesRuido = r4.paredes.filter((p) => p.orientacion === "vertical" && Math.abs(p.x1 - 50) <= 1);
assert(verticalesRuido.length === 1, `Un hueco chico (2px, ruido) se puentea — sigue siendo UNA sola línea (real: ${verticalesRuido.length})`);

// --- 5. Mismo hueco de puerta plausible, pero SIN escala: no se sugiere nada (no se adivina) ---
const r5 = App.plano.detectarParedesCandidatas(conPuerta, ANCHO, ALTO);
assert(r5.puertas.length === 0, "Sin escala, el mismo hueco NO se sugiere como puerta (no hay cómo juzgar el ancho real)");

console.log("\nTodas las pruebas completadas.");
