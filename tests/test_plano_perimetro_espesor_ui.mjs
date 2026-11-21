import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4343"), { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);
await page.locator('input[type="file"][accept="image/*,application/pdf"]').setInputFiles(
  DIR + "fixtures/plano_test.png"
);
await page.waitForTimeout(400);

// Acotado al panel de Plano (identificado por su grid 1fr/280px, único
// en la app) — Diagrama unifilar también tiene su propio <g> de pan/zoom
// con el mismo formato desde que tiene zoom propio (ver nota de sesión).
const panelPlano = page.locator('div[style*="grid-template-columns: 1fr 280px"]').first();
const svgPlano = panelPlano.locator("svg").last();
const REGEX_PAN_ZOOM = /translate\(([-\d.]+),([-\d.]+)\) scale\(([-\d.]+)\)/;
async function grupoPanZoomPlano() {
  const grupos = await panelPlano.locator("svg > g").all();
  for (const g of grupos) {
    const t = await g.getAttribute("transform");
    if (t && REGEX_PAN_ZOOM.test(t)) return g;
  }
  throw new Error("No se encontró el grupo de pan/zoom del Plano.");
}
async function puntoPantallaDesdeImagen(puntoImagen) {
  const grupo = await grupoPanZoomPlano();
  const box = await svgPlano.boundingBox();
  const t = await grupo.getAttribute("transform");
  const m = t.match(REGEX_PAN_ZOOM);
  const panX = parseFloat(m[1]), panY = parseFloat(m[2]), zoom = parseFloat(m[3]);
  return { x: box.x + puntoImagen.x * zoom + panX, y: box.y + puntoImagen.y * zoom + panY };
}

// --- 1. Calibración por perímetro: un cuadrado de 400x400px en la imagen ---
await panelPlano.getByRole("button", { name: "Calibrar por perímetro", exact: true }).click();
await page.waitForTimeout(150);

// Desactivamos la asistencia de bordes para este test — queremos
// control píxel-perfecto sobre dónde cae cada click (para que la
// aritmética de la escala/espesor dé un número exacto conocido),
// no que se "pegue" al filo más cercano de la imagen de prueba.
await panelPlano.locator("label", { hasText: "Asistencia de bordes" }).locator('input[type="checkbox"]').uncheck();
await page.waitForTimeout(80);
const contorno = [
  { x: 100, y: 100 },
  { x: 500, y: 100 },
  { x: 500, y: 500 },
  { x: 100, y: 500 },
];
for (const punto of contorno) {
  const p = await puntoPantallaDesdeImagen(punto);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(80);
}
assert(await panelPlano.getByText("4 puntos trazados").isVisible(), "Los 4 puntos del contorno quedan registrados");
// Perímetro en píxeles del cuadrado: 4*400 = 1600px. Perímetro real: 32m -> escala = 32/1600 = 0.02 m/px.
await panelPlano.getByPlaceholder("Ej: 60").fill("32");
// .last(): el botón de modo "Calibrar" (2 puntos) y el de confirmar
// este formulario dicen lo mismo — mismo criterio que test_plano.mjs
// al confirmar su propia calibración de 2 puntos.
await panelPlano.getByRole("button", { name: "Calibrar", exact: true }).last().click();
await page.waitForTimeout(200);
assert(await panelPlano.getByText("Calibrado por perímetro: 32m real").isVisible(), "Se calibró por perímetro — el texto lo confirma");
// El mouse simulado redondea a píxeles de pantalla enteros, así que el
// último decimal puede variar un poco (mismo criterio que test_plano.mjs) —
// se tolera un margen chico en vez de exigir el dígito exacto.
const textoEscala = await panelPlano.locator("div", { hasText: "Calibrado por perímetro" }).last().textContent();
const escalaMatch = textoEscala.match(/([\d.]+) m\/px/);
const escalaReal = parseFloat(escalaMatch[1]);
assert(Math.abs(escalaReal - 0.02) < 0.001, `La escala calculada es ~32/1600 = 0.02 m/px (real: ${escalaReal})`);

// --- 2. Trazar una pared (2 puntos, modo "pared" ya activo tras calibrar) ---
let p = await puntoPantallaDesdeImagen({ x: 150, y: 150 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(100);
p = await puntoPantallaDesdeImagen({ x: 450, y: 150 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(100);
await panelPlano.getByRole("button", { name: "Trazar pared", exact: true }).click(); // termina el trazo sin cerrarlo (no es obligatorio cerrar para medir espesor)
await page.waitForTimeout(100);

// --- 3. Medir espesor: 2 clicks a los lados de esa pared (en y=150, separados 10px -> 0.2m) ---
await panelPlano.getByRole("button", { name: "Medir espesor", exact: true }).click();
await page.waitForTimeout(100);
p = await puntoPantallaDesdeImagen({ x: 300, y: 145 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(80);
p = await puntoPantallaDesdeImagen({ x: 300, y: 155 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(150);
// distancia ~10px * ~0.02 m/px = ~20cm (tolerancia por redondeo de píxeles de pantalla, igual criterio que arriba)
const textoAviso = await page.getByText(/Espesor guardado: [\d.]+ cm/).textContent();
const espesorCm = parseFloat(textoAviso.match(/([\d.]+) cm/)[1]);
assert(Math.abs(espesorCm - 20) < 1, `El espesor se calcula con la escala vigente (~10px * ~0.02m/px ≈ 20cm, real: ${espesorCm}cm)`);
assert((await panelPlano.locator("svg text").filter({ hasText: /^\d+\.\dcm$/ }).count()) >= 1, "La pared medida muestra su espesor como etiqueta en el lienzo");

// --- 4. Medir espesor lejos de cualquier pared: se rechaza, no inventa nada ---
p = await puntoPantallaDesdeImagen({ x: 50, y: 450 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(80);
p = await puntoPantallaDesdeImagen({ x: 60, y: 450 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(150);
assert(await page.getByText("No hay ninguna pared cerca de esos 2 puntos").isVisible(), "Medir espesor lejos de cualquier pared se rechaza explícitamente");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await page.screenshot({ path: DIR + "tmp/plano_perimetro_espesor.png", fullPage: true });
await browser.close();
