// Medidas directo sobre el plano (usuario, 2026-11-27, probando el
// .zip en su propia PC: "sugiero que en el plano cuando se dibuja se
// señale las medidas del de cada pared y de cada ambiente... me perdí
// la verdad después de añadir una cantidad de ambientes"). 2 piezas,
// ambas puramente visuales sobre el lienzo (PlanoCanvas.jsx), ningún
// cálculo nuevo — reusan datos que ya existían:
//   1. Cada segmento (pared/conductor) ahora muestra su largo real
//      (metros) bajo la línea, siempre, no solo al "Medir espesor".
//   2. Cada ambiente ya generado muestra su área/perímetro (ya
//      calculados, antes solo vivían en la lista lateral "Ambientes")
//      en su centroide, directo sobre el dibujo.
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

// --- 1. Trazar una pared recta: (100,300) a (500,300) = 400px = 5m exactos ---
await panelPlano.getByRole("button", { name: "Trazar pared", exact: true }).click();
await page.waitForTimeout(100);
await panelPlano.locator("label", { hasText: "Asistencia de bordes" }).locator('input[type="checkbox"]').uncheck();
await page.waitForTimeout(80);
await click({ x: 100, y: 300 });
await click({ x: 500, y: 300 });
await panelPlano.getByRole("button", { name: "Trazar pared", exact: true }).click(); // termina el trazo sin cerrarlo
await page.waitForTimeout(200);

assert((await svg.getByText("5.00m", { exact: true }).count()) === 1, "La pared recién trazada (400px = 5m) muestra su largo real en el lienzo");

// --- 2. Generar un ambiente de 4m x 3m (12 m², perímetro 14m) con un click ---
await panelPlano.getByRole("button", { name: "Generar ambiente", exact: true }).click();
await page.waitForTimeout(100);
await panelPlano.getByPlaceholder("Nombre (ej. Habitación #1)").fill("Cuarto de prueba");
await panelPlano.getByPlaceholder("Ancho (m)").fill("4");
await panelPlano.getByPlaceholder("Largo (m)").fill("3");
await click({ x: 400, y: 500 }); // lejos de la pared trazada arriba, para no superponerse
await page.waitForTimeout(250);

assert((await svg.getByText("4.00m", { exact: true }).count()) >= 1, "Un lado del ambiente generado (4m de ancho) muestra su largo real");
assert((await svg.getByText("3.00m", { exact: true }).count()) >= 1, "El otro lado del ambiente generado (3m de largo) muestra su largo real");
assert((await svg.getByText("12.00m² · 14.00m perímetro", { exact: true }).count()) === 1, "El ambiente generado (4m×3m) muestra su área y perímetro EXACTOS en el lienzo (12.00 m² · 14.00 m)");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await browser.close();
