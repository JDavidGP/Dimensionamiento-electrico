// Nombre del ambiente al tocarlo (usuario, 2026-11-27, probando el
// .zip en su PC: "cumple un rol informativo para el instalador, así
// localiza y realiza los cambios que quiera más fácil"). En modo
// "Mover vista" (el único donde un click SIN arrastre no hacía
// absolutamente nada antes de esto), tocar dentro de un ambiente ya
// generado revela su nombre arriba de su área/perímetro (que ya se
// mostraba siempre) — tocar el MISMO ambiente de nuevo lo oculta
// (toggle), tocar OTRO lo cambia, y tocar fuera de cualquier ambiente
// lo oculta.
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

// --- 1. Generar 2 ambientes separados, cada uno con su propio nombre ---
await panelPlano.getByRole("button", { name: "Generar ambiente", exact: true }).click();
await page.waitForTimeout(100);
await panelPlano.getByPlaceholder("Nombre (ej. Habitación #1)").fill("Dormitorio");
await panelPlano.getByPlaceholder("Ancho (m)").fill("4");
await panelPlano.getByPlaceholder("Largo (m)").fill("3");
await click({ x: 150, y: 150 });
await page.waitForTimeout(200);

await panelPlano.getByPlaceholder("Nombre (ej. Habitación #1)").fill("Cocina");
await panelPlano.getByPlaceholder("Ancho (m)").fill("4");
await panelPlano.getByPlaceholder("Largo (m)").fill("3");
await click({ x: 450, y: 450 });
await page.waitForTimeout(200);

// --- 2. "Mover vista" (el modo por default) — tocar dentro de "Dormitorio" revela su nombre ---
await panelPlano.getByRole("button", { name: "Mover vista", exact: true }).click();
await page.waitForTimeout(100);
assert((await svg.getByText("Dormitorio", { exact: true }).count()) === 0, "Antes de tocar nada, ningún nombre de ambiente está visible");

await click({ x: 150, y: 150 }); // dentro de "Dormitorio"
assert((await svg.getByText("Dormitorio", { exact: true }).count()) === 1, "Tocar dentro de 'Dormitorio' revela su nombre");
assert((await svg.getByText("Cocina", { exact: true }).count()) === 0, "...pero NO el de 'Cocina' (no se revelan todos a la vez)");

// --- 3. Tocar el MISMO ambiente de nuevo lo oculta (toggle) ---
await click({ x: 150, y: 150 });
assert((await svg.getByText("Dormitorio", { exact: true }).count()) === 0, "Tocar el mismo ambiente de nuevo oculta su nombre (toggle)");

// --- 4. Tocar OTRO ambiente cambia cuál está revelado ---
await click({ x: 150, y: 150 }); // revela Dormitorio de nuevo
await click({ x: 450, y: 450 }); // toca Cocina
assert((await svg.getByText("Cocina", { exact: true }).count()) === 1, "Tocar 'Cocina' revela SU nombre");
assert((await svg.getByText("Dormitorio", { exact: true }).count()) === 0, "...y oculta el de 'Dormitorio' (uno a la vez)");

// --- 5. Tocar fuera de cualquier ambiente oculta el que estuviera revelado ---
await click({ x: 700, y: 50 }); // esquina lejos de ambos ambientes
assert((await svg.getByText("Cocina", { exact: true }).count()) === 0, "Tocar fuera de cualquier ambiente oculta el nombre que estuviera revelado");

// --- 6. El área/perímetro de cada ambiente sigue SIEMPRE visible, con o sin nombre revelado ---
assert((await svg.getByText("12.00m² · 14.00m perímetro").count()) === 2, "El área/perímetro de ambos ambientes sigue visible siempre (2 ambientes de 4m×3m)");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await browser.close();
