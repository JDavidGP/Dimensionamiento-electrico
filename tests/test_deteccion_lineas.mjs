// Detección de líneas candidatas (paredes) + huecos candidatos a
// puerta (usuario, 2026-11-20) — probado con una imagen SINTÉTICA
// (un array de grises armado a mano, no un archivo), para conocer
// exactamente dónde "debería" encontrar cada línea.
import { ApplicationMediator as App } from "../src/core/ApplicationMediator.ts";

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

// --- 6. Pared gruesa dibujada con 2 líneas paralelas MUY cerca (ej.
//     interior/exterior de una pared de bloque) — con escala, se
//     fusionan en 1 sola candidata (usuario, 2026-11-26, "Reconocer
//     paredes... todavía no funciona bien", demasiadas candidatas para
//     revisar una por una). ---
const paredGruesa = lienzoBlanco();
trazarLineaHorizontal(paredGruesa, 50, 10, 190);
trazarLineaHorizontal(paredGruesa, 70, 10, 190); // 20px más abajo — con escala 0.01 m/px, 0.2m real: una pared de bloque gruesa, dentro del umbral de fusión (0.3m)
const r6 = App.plano.detectarParedesCandidatas(paredGruesa, ANCHO, ALTO, { escalaMetrosPorPixel: 0.01 });
assert(r6.paredes.length === 1, `Con escala, las 2 caras de la pared gruesa se fusionan en 1 sola candidata (real: ${r6.paredes.length})`);

// Sin escala, NO hay cómo distinguir "2 caras de 1 pared" de "2
// paredes reales de un pasillo angosto" — no se fusiona nada (mismo
// criterio que las puertas: no se adivina sin calibrar).
const r6b = App.plano.detectarParedesCandidatas(paredGruesa, ANCHO, ALTO);
assert(r6b.paredes.length === 2, `Sin escala, NO se fusiona — quedan las 2 candidatas separadas, tal como siempre (real: ${r6b.paredes.length})`);

// --- 7. 2 paredes REALES, paralelas, de un pasillo angosto — más
//     lejos que GROSOR_PARED_MAX_FUSION_M (0.3m) entre sí — NUNCA se
//     fusionan, aunque haya escala (perderías el pasillo entero). ---
const pasillo = lienzoBlanco();
trazarLineaHorizontal(pasillo, 50, 10, 190);
trazarLineaHorizontal(pasillo, 100, 10, 190); // 50px más abajo — con la MISMA escala 0.01 m/px, 0.5m real: ya un pasillo angosto, no el espesor de una pared
const r7 = App.plano.detectarParedesCandidatas(pasillo, ANCHO, ALTO, { escalaMetrosPorPixel: 0.01 });
assert(r7.paredes.length === 2, `Un pasillo angosto real (0.5m) NUNCA se fusiona en 1, aunque esté calibrado (real: ${r7.paredes.length})`);

// --- 8. Candidata corta (mueble/cota/texto, no una pared estructural)
//     — con escala, se descarta si su largo REAL cae por debajo de
//     LARGO_MINIMO_PARED_M (0.5m); sin escala, el filtro en píxeles de
//     siempre (LARGO_MINIMO_TRAMO_PX) es el único que corre. ---
const lienzoCorta = lienzoBlanco();
trazarLineaHorizontal(lienzoCorta, 50, 10, 34); // 25px — pasa el filtro en píxeles (20px) de siempre
const r8calibrado = App.plano.detectarParedesCandidatas(lienzoCorta, ANCHO, ALTO, { escalaMetrosPorPixel: 0.01 }); // 25px × 0.01 = 0.25m real, por debajo de 0.5m
assert(r8calibrado.paredes.length === 0, `Candidata de 25px (0.25m real) se descarta por corta al estar calibrado (real: ${r8calibrado.paredes.length})`);
const r8sinCalibrar = App.plano.detectarParedesCandidatas(lienzoCorta, ANCHO, ALTO);
assert(r8sinCalibrar.paredes.length === 1, `La MISMA candidata, sin escala, sigue apareciendo — sin escala no hay largo real que juzgar (real: ${r8sinCalibrar.paredes.length})`);

// --- 9. Las candidatas vuelven ordenadas de más larga a más corta —
//     revisar "una por una" encuentra primero las que con más
//     confianza son una pared real. ---
// Largos DELIBERADAMENTE parecidos entre sí (100/120/150px, nunca por
// debajo de la mitad de la más larga) — el umbral RELATIVO de siempre
// (UMBRAL_RELATIVO_PICO, 50% del máximo) ya descarta de entrada una
// candidata mucho más corta que la más fuerte de la imagen (ej. 25px
// contra una de 150px no llega ni a "candidata" — esperado, no es lo
// que esta prueba puntual quiere ejercitar); lo que se prueba acá es
// SOLO el orden final entre candidatas que de verdad se detectaron.
const variasLargas = lienzoBlanco();
trazarLineaHorizontal(variasLargas, 20, 10, 109); // 100px, la más corta
trazarLineaHorizontal(variasLargas, 70, 10, 129); // 120px, media
trazarLineaHorizontal(variasLargas, 120, 10, 159); // 150px, la más larga
const r9 = App.plano.detectarParedesCandidatas(variasLargas, ANCHO, ALTO);
assert(r9.paredes.length === 3, `Las 3 candidatas de distinto largo se detectan (real: ${r9.paredes.length})`);
const largos = r9.paredes.map((p) => Math.hypot(p.x2 - p.x1, p.y2 - p.y1));
assert(largos[0] > largos[1] && largos[1] > largos[2], `Vienen ordenadas de más larga a más corta (real: ${JSON.stringify(largos.map((l) => Math.round(l)))})`);

console.log("\nTodas las pruebas completadas.");
