// "Sugerir paredes" (usuario, 2026-11-20, asistencia mejorada de
// trazado) — imagen SINTÉTICA con 4 líneas rectas (un rectángulo) y un
// hueco de ~40px en la pared derecha, generada por plano_lineas_test.png
// (ver el script Python que la crea). Con una calibración de 0.02 m/px,
// ese hueco de 40px = 0.8m, dentro del rango plausible de puerta.
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
  DIR + "fixtures/plano_lineas_test.png"
);
await page.waitForTimeout(400);

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

// --- 1. Calibrar: pared superior, 50->350px = 300px = 6m real -> 0.02 m/px ---
await panelPlano.getByRole("button", { name: "Calibrar", exact: true }).click();
await page.waitForTimeout(150);
let p = await puntoPantallaDesdeImagen({ x: 50, y: 50 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(80);
p = await puntoPantallaDesdeImagen({ x: 350, y: 50 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(80);
await panelPlano.getByPlaceholder("Ej: 5").fill("6");
await panelPlano.getByRole("button", { name: "Calibrar", exact: true }).last().click();
await page.waitForTimeout(200);
assert(await panelPlano.getByText(/Calibrado:/).last().isVisible(), "Calibración de 2 puntos lista (necesaria para juzgar el ancho de puerta)");

// --- 2. Reconocer paredes (área) — arrastrar un rectángulo que cubra
// TODA la imagen (400x300), con margen, en vez del viejo botón
// "Sugerir paredes" (que siempre leía el plano completo sin elegir
// zona — reemplazado 2026-11-24 por este modo de arrastre, mismo
// gesto que "Trazar rectángulo"). Nota: el aviso-toast (5s) y el
// estado persistente del panel comparten la palabra "candidata(s)" —
// se usa una frase exclusiva del estado persistente ("...del lienzo
// para confirmarla") para no ambigüar.
await panelPlano.getByRole("button", { name: "Reconocer paredes (área)", exact: true }).click();
await page.waitForTimeout(150);
let pA = await puntoPantallaDesdeImagen({ x: 10, y: 10 });
let pB = await puntoPantallaDesdeImagen({ x: 390, y: 290 });
await page.mouse.move(pA.x, pA.y);
await page.mouse.down();
await page.mouse.move((pA.x + pB.x) / 2, (pA.y + pB.y) / 2, { steps: 5 });
await page.mouse.move(pB.x, pB.y, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(300);
const estadoSugerencias = panelPlano.getByText(/del lienzo para confirmarla/);
assert(await estadoSugerencias.isVisible(), "Aparece el estado persistente de sugerencias");
const textoSugerencias = await estadoSugerencias.textContent();
assert(/posible\(s\) puerta\(s\)/.test(textoSugerencias), `Detecta al menos una posible puerta (real: '${textoSugerencias}')`);

// Las sugerencias usan stroke-dasharray "X Y" con X>Y (pared) para distinguirlas de otros trazos punteados.
const todasLasLineas = await panelPlano.locator("svg line").all();
let cuentaParedSugerida = 0;
for (const l of todasLasLineas) {
  const dash = await l.getAttribute("stroke-dasharray");
  if (dash && /^[\d.]+ [\d.]+$/.test(dash)) {
    const [a, b] = dash.split(" ").map(Number);
    if (a > b) cuentaParedSugerida++;
  }
}
assert(cuentaParedSugerida >= 4, `Al menos 4 tramos de pared sugeridos (real: ${cuentaParedSugerida})`);

// --- 3. Aceptar UNA sugerencia: click en la pared superior sugerida ---
const totalNodosAntes = (await panelPlano.locator("svg circle").count());
p = await puntoPantallaDesdeImagen({ x: 200, y: 50 }); // punto medio de la pared superior
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);
const totalNodosDespues = await panelPlano.locator("svg circle").count();
assert(totalNodosDespues === totalNodosAntes + 2, `Aceptar una sugerencia crea los 2 nodos reales del tramo (antes: ${totalNodosAntes}, después: ${totalNodosDespues})`);

// --- 4. Descartar el resto ---
await panelPlano.getByRole("button", { name: "Descartar", exact: true }).click();
await page.waitForTimeout(150);
assert((await panelPlano.getByText(/del lienzo para confirmarla/).count()) === 0, "Descartar quita el resto de las sugerencias sin crear nada más");

// --- 5. Acotar a una zona chica que EXCLUYE la pared derecha (y su
// puerta) — prueba real de que el área de arrastre de verdad recorta
// qué se analiza, no solo re-etiqueta el viejo comportamiento de leer
// SIEMPRE el plano completo bajo un gatillo distinto. ---
pA = await puntoPantallaDesdeImagen({ x: 10, y: 10 });
pB = await puntoPantallaDesdeImagen({ x: 300, y: 290 }); // corta antes de la pared derecha (~x=350)
await page.mouse.move(pA.x, pA.y);
await page.mouse.down();
await page.mouse.move((pA.x + pB.x) / 2, (pA.y + pB.y) / 2, { steps: 5 });
await page.mouse.move(pB.x, pB.y, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(300);
const textoAcotado = await panelPlano.getByText(/del lienzo para confirmarla/).textContent();
assert(!/posible\(s\) puerta\(s\)/.test(textoAcotado), `Acotando el área SIN la pared derecha, ya no detecta la puerta que está ahí (real: '${textoAcotado}')`);
await panelPlano.getByRole("button", { name: "Descartar", exact: true }).click();
await page.waitForTimeout(150);

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await page.screenshot({ path: DIR + "tmp/plano_sugerir_paredes.png", fullPage: true });
await browser.close();
