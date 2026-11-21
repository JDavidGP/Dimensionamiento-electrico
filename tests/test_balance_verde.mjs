import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto((process.env.BASE_URL || "http://localhost:4323"), { waitUntil: "networkidle" });

await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("Panel B");
await page.locator("form").getByRole("button", { name: "Tri", exact: true }).click();
await page.getByPlaceholder("Desde el origen").fill("10");
await page.getByRole("button", { name: "+ Crear tablero" }).click();

async function crearCircuito(nombre) {
  await page.getByPlaceholder("Ej: Iluminación cocina").fill(nombre);
  await page.locator("label:has-text('Distancia (m)')").locator("..").locator("input").fill("5");
  await page.getByRole("button", { name: "+ Crear circuito" }).click();
}
async function agregarEquipo(potenciaW) {
  await page.getByPlaceholder("Ej: Refrigerador").fill("carga");
  const campoValor = page.locator("label:has-text('P unitaria (W)')").locator("..").locator("input");
  await campoValor.fill(String(potenciaW));
  await page.getByRole("button", { name: "+ Agregar equipo" }).click();
}

await crearCircuito("C1"); await agregarEquipo(1200); // 10A
await crearCircuito("C2"); await agregarEquipo(1200); // 10A
await crearCircuito("C3"); await agregarEquipo(1260); // 10.5A

const selectsTablero = page.getByRole("combobox", { name: /^Tablero de/ });
const n = await selectsTablero.count();
for (let i = 0; i < n; i++) await selectsTablero.nth(i).selectOption({ label: "Panel B" });

async function asignarLinea(nombreCircuito, linea) {
  const select = page.locator(`[aria-label="Tablero de ${nombreCircuito}"]`);
  const fila = select.locator("xpath=..");
  await fila.click();
  await page.getByRole("button", { name: linea, exact: true }).first().click();
  await fila.click();
}
await asignarLinea("C1", "L1");
await asignarLinea("C2", "L2");
await asignarLinea("C3", "L3");

await page.waitForTimeout(300);
const pct = await page.getByText(/^\d+\.\d%$/).first().textContent().catch(() => null);
console.log("Porcentaje mostrado:", pct);
const dotColor = await page.locator("div").filter({hasText:"BALANCE DE FASES"}).locator("xpath=preceding-sibling::div[1]").evaluate(el => getComputedStyle(el).backgroundColor).catch(()=>null);
console.log("Color del punto de estado:", dotColor);
const sugerenciaVisible = await page.getByText("Sugerencia para mejorar el balance").isVisible().catch(() => false);
console.log("Sugerencia visible (no debería, está balanceado):", sugerenciaVisible);

await page.screenshot({ path: DIR + "tmp/balance_verde.png", fullPage: true });
await browser.close();
