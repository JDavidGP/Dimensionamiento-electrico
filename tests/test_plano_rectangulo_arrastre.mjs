import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

// Modo "Trazar rectángulo" (usuario, 2026-11-23: "hacemos click y
// estiramos un polígono... click en una esquina de esa habitación y
// estiramos hacia la otra esquina") — tercera forma de crear un
// ambiente rectangular, junto al trazado manual punto por punto y
// "Generar ambiente" por medida ya conocida. Mismo patrón de
// calibración/click que test_plano.mjs, pero con mouse.down/move/up
// en vez de clicks sueltos.

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
page.on("dialog", (d) => d.accept("Dormitorio arrastrado"));
await page.goto((process.env.BASE_URL || "http://localhost:4354"), { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);

await page.locator('input[type="file"][accept="image/*,application/pdf"]').setInputFiles(DIR + "fixtures/plano_test.png");
await page.waitForTimeout(400);

async function puntoPantallaDesdeImagen(puntoImagen) {
  const svg = page.locator("svg").last();
  const box = await svg.boundingBox();
  const transformAttr = await page.locator("svg > g").last().getAttribute("transform");
  const m = transformAttr.match(/translate\(([-\d.]+),([-\d.]+)\) scale\(([-\d.]+)\)/);
  const panX = parseFloat(m[1]), panY = parseFloat(m[2]), zoom = parseFloat(m[3]);
  return { x: box.x + puntoImagen.x * zoom + panX, y: box.y + puntoImagen.y * zoom + panY };
}

// --- 1. Calibrar: 400px de imagen = 5 metros ---
await page.getByRole("button", { name: "Calibrar", exact: true }).click();
await page.waitForTimeout(150);
let p = await puntoPantallaDesdeImagen({ x: 100, y: 100 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(100);
p = await puntoPantallaDesdeImagen({ x: 500, y: 100 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(150);
await page.getByPlaceholder("Ej: 5").fill("5");
await page.getByRole("button", { name: "Calibrar", exact: true }).last().click();
await page.waitForTimeout(200);

// --- 2. Modo "Trazar rectángulo" sin calibrar NO existe acá (ya está
//     calibrado) — probar directamente el arrastre: 400x300px de
//     imagen = 5m x 3.75m reales ---
assert((await page.getByRole("button", { name: "Trazar rectángulo", exact: true }).count()) === 1, "El modo 'Trazar rectángulo' existe en la barra de modos");
await page.getByRole("button", { name: "Trazar rectángulo", exact: true }).click();
await page.waitForTimeout(150);

const esquinaA = await puntoPantallaDesdeImagen({ x: 100, y: 100 });
const esquinaB = await puntoPantallaDesdeImagen({ x: 500, y: 400 });
await page.mouse.move(esquinaA.x, esquinaA.y);
await page.mouse.down();
await page.mouse.move((esquinaA.x + esquinaB.x) / 2, (esquinaA.y + esquinaB.y) / 2, { steps: 5 });
await page.mouse.move(esquinaB.x, esquinaB.y, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(300);

assert((await page.getByText(/"Dormitorio arrastrado" generado/).count()) === 1, "Avisa que el ambiente se generó al soltar");
const panelAmbientes = page.getByText("Plano inteligente", { exact: true }).locator("xpath=../../..");
assert((await panelAmbientes.getByText("Ambientes (1)").count()) === 1, "Se registró 1 ambiente al soltar el arrastre");
assert((await panelAmbientes.locator('input[value="Dormitorio arrastrado"]').count()) === 1, "El nombre ingresado en el prompt se usó para el ambiente");

const textoArea = await page.locator("div", { hasText: /m² · perímetro/ }).last().textContent();
const matchArea = textoArea.match(/([\d.]+) m² · perímetro ([\d.]+) m/);
const areaNum = parseFloat(matchArea[1]);
const perimNum = parseFloat(matchArea[2]);
// Misma tolerancia que test_plano.mjs — precisión de 1px del mouse simulado.
assert(Math.abs(areaNum - 18.75) < 0.1, `Área calculada ≈ 5m × 3.75m = 18.75 m² (real: ${areaNum})`);
assert(Math.abs(perimNum - 17.5) < 0.1, `Perímetro calculado ≈ 2×(5+3.75) = 17.50 m (real: ${perimNum})`);

// --- 3. Un arrastre casi nulo (click sin mover) NO genera un ambiente inventado ---
const puntoQuieto = await puntoPantallaDesdeImagen({ x: 50, y: 500 });
await page.mouse.move(puntoQuieto.x, puntoQuieto.y);
await page.mouse.down();
await page.mouse.move(puntoQuieto.x + 1, puntoQuieto.y + 1);
await page.mouse.up();
await page.waitForTimeout(200);
assert((await panelAmbientes.getByText("Ambientes (1)").count()) === 1, "Un arrastre casi nulo (sin mover de verdad) no crea un segundo ambiente inventado");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/plano_rectangulo_arrastre.png", fullPage: true });
await browser.close();
