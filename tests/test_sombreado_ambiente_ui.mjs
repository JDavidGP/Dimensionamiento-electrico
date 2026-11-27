// Sombreado por ambiente (usuario, 2026-11-27, pensando en concepto
// abierto: "un sombreado para determinar cada ambiente... para que se
// distingan entre sí"). Prueba la UI real: cada ambiente generado
// dibuja un <polygon> de su color categórico estable (nunca por
// posición en el array), semi-transparente y SIN interceptar clicks —
// trazar/clickear ENCIMA del sombreado sigue funcionando exactamente
// igual que antes de agregarlo.
import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto(process.env.BASE_URL || "http://localhost:4343", { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

const panelPlano = page.locator('div[style*="grid-template-columns: 1fr 280px"]').first();
const svg = panelPlano.locator("svg").last();
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
  const box = await svg.boundingBox();
  const t = await grupo.getAttribute("transform");
  const m = t.match(REGEX_PAN_ZOOM);
  const panX = parseFloat(m[1]), panY = parseFloat(m[2]), zoom = parseFloat(m[3]);
  return { x: box.x + puntoImagen.x * zoom + panX, y: box.y + puntoImagen.y * zoom + panY };
}
async function click(puntoImagen) {
  const p = await puntoPantallaDesdeImagen(puntoImagen);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(100);
}

await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);
await page.locator('input[type="file"][accept="image/*,application/pdf"]').setInputFiles(DIR + "fixtures/plano_test.png");
await page.waitForTimeout(400);

await panelPlano.getByRole("button", { name: "Calibrar", exact: true }).click();
await page.waitForTimeout(150);
await click({ x: 100, y: 100 });
await click({ x: 500, y: 100 });
await panelPlano.getByPlaceholder("Ej: 5").fill("5"); // 400px = 5m -> 0.0125 m/px
await panelPlano.getByRole("button", { name: "Calibrar", exact: true }).last().click();
await page.waitForTimeout(200);

assert((await svg.locator("polygon").count()) === 0, "Sin ningún ambiente todavía, ningún sombreado dibujado");

// --- 1. Generar 2 ambientes separados ---
await panelPlano.getByRole("button", { name: "Generar ambiente", exact: true }).click();
await page.waitForTimeout(100);
await panelPlano.getByPlaceholder("Nombre (ej. Habitación #1)").fill("Sala");
await panelPlano.getByPlaceholder("Ancho (m)").fill("4");
await panelPlano.getByPlaceholder("Largo (m)").fill("3");
await click({ x: 150, y: 150 });
await page.waitForTimeout(200);

await panelPlano.getByPlaceholder("Nombre (ej. Habitación #1)").fill("Comedor");
await panelPlano.getByPlaceholder("Ancho (m)").fill("4");
await panelPlano.getByPlaceholder("Largo (m)").fill("3");
await click({ x: 450, y: 450 });
await page.waitForTimeout(200);

const poligonos = svg.locator("polygon");
assert((await poligonos.count()) === 2, "Cada ambiente generado dibuja su propio <polygon> de sombreado");

const fill1 = await poligonos.nth(0).getAttribute("fill");
const fill2 = await poligonos.nth(1).getAttribute("fill");
assert(/^var\(--ambiente-\d\)$/.test(fill1), `El color viene de la paleta categórica (CSS var), no un hex suelto (real: '${fill1}')`);
assert(fill1 !== fill2, `2 ambientes distintos tienen colores DISTINTOS entre sí (real: '${fill1}' vs '${fill2}')`);

const puntos1 = (await poligonos.nth(0).getAttribute("points")).trim().split(/\s+/);
assert(puntos1.length === 4, `El sombreado de un ambiente rectangular tiene 4 puntos (real: ${puntos1.length})`);

const opacidad1 = await poligonos.nth(0).getAttribute("fill-opacity");
assert(parseFloat(opacidad1) < 0.5, `El sombreado es semi-transparente, no un color sólido (real: '${opacidad1}')`);

const pointerEvents1 = await poligonos.nth(0).getAttribute("pointer-events");
assert(pointerEvents1 === "none", "El sombreado NUNCA intercepta clicks (pointer-events: none) — paredes/equipos siguen siendo lo clickeable");

// --- 2. El color es ESTABLE por habitación — recargar el plano (deshacer y rehacer un trazo cualquiera, forzando un re-render) no lo cambia ---
await panelPlano.getByRole("button", { name: "Trazar pared", exact: true }).click();
await page.waitForTimeout(100);
await click({ x: 700, y: 100 });
await click({ x: 750, y: 100 });
await panelPlano.getByRole("button", { name: "↶ Deshacer", exact: true }).click();
await page.waitForTimeout(150);
const fill1Despues = await svg.locator("polygon").nth(0).getAttribute("fill");
assert(fill1Despues === fill1, `El color del mismo ambiente sigue siendo el mismo tras un re-render ajeno (real: '${fill1Despues}')`);

// --- 3. Trazar una pared ENCIMA del sombreado sigue funcionando normal (pointer-events:none de verdad no bloquea nada) ---
await panelPlano.getByRole("button", { name: "Trazar pared", exact: true }).click();
await page.waitForTimeout(100);
const circulosAntes = await svg.locator("g circle").count();
await click({ x: 150, y: 150 }); // justo encima del sombreado de "Sala"
await page.waitForTimeout(150);
const circulosDespues = await svg.locator("g circle").count();
assert(circulosDespues > circulosAntes, "Clickear ENCIMA del sombreado de un ambiente para trazar una pared sigue creando un nodo normal (el sombreado no bloquea nada)");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await browser.close();
