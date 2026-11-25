import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
await page.goto((process.env.BASE_URL || "http://localhost:4352"), { waitUntil: "networkidle" });

async function puntoPantallaDesdeImagen(puntoImagen) {
  const svg = page.locator("svg").last();
  const box = await svg.boundingBox();
  const transformAttr = await page.locator("svg > g").last().getAttribute("transform");
  const m = transformAttr.match(/translate\(([-\d.]+),([-\d.]+)\) scale\(([-\d.]+)\)/);
  const panX = parseFloat(m[1]), panY = parseFloat(m[2]), zoom = parseFloat(m[3]);
  return { x: box.x + puntoImagen.x * zoom + panX, y: box.y + puntoImagen.y * zoom + panY, zoom };
}

await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);
await page.locator('input[type="file"][accept="image/*,application/pdf"]').setInputFiles(
  DIR + "fixtures/plano_blanco.png"
);
await page.waitForTimeout(400);

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

await page.getByRole("button", { name: "Trazar conductor", exact: true }).click();
await page.waitForTimeout(150);
for (const punto of [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 400 }]) {
  const pp = await puntoPantallaDesdeImagen(punto);
  await page.mouse.click(pp.x, pp.y);
  await page.waitForTimeout(150);
}
page.once("dialog", (d) => d.accept("Conductor visual"));
await page.getByRole("button", { name: /Terminar ruta/ }).click();
await page.waitForTimeout(250);

await page.getByRole("button", { name: "Colocar equipo", exact: true }).click();
await page.waitForTimeout(150);
const barraEquipo = page.locator('input[placeholder="Nombre (opcional)"]').locator("xpath=..");
// select(0) es "¿Equipo ya ingresado?" (usuario, 2026-11-25) — el tipo
// de equipo es el select(1) de esta barra.
await barraEquipo.locator("select").nth(1).selectOption("luminaria");
await page.waitForTimeout(100);
let pEquipo = await puntoPantallaDesdeImagen({ x: 300, y: 250 });
await page.mouse.click(pEquipo.x, pEquipo.y);
await page.waitForTimeout(150);
await barraEquipo.locator("select").nth(1).selectOption("tablero_electrico");
await page.waitForTimeout(100);
pEquipo = await puntoPantallaDesdeImagen({ x: 450, y: 350 });
await page.mouse.click(pEquipo.x, pEquipo.y);
await page.waitForTimeout(250);

await page.screenshot({ path: DIR + "tmp/plano_visual_check.png", fullPage: true });
await browser.close();
console.log("listo");
