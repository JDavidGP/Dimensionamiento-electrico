import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4326"), { waitUntil: "networkidle" });

await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("Casa");
await page.getByText("+ Nueva fuente de energía (Batería/Generador)").click();
await page.getByPlaceholder("Ej: Banco de baterías solar, Generador diesel 10kW").fill("Banco solar 5kWh");
await page.locator("form").getByRole("button", { name: "Batería", exact: true }).click();
await page.locator("form").getByRole("button", { name: "Principal", exact: true }).click();
await page.getByRole("button", { name: "+ Crear y usar como origen" }).click();
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(300);

const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: /Guardar/ }).click(),
]);
const ruta = await download.path();
const fs = await import("fs");
const json = JSON.parse(fs.readFileSync(ruta, "utf-8"));
console.log("fuentesEnergia en el JSON guardado:", JSON.stringify(json.fuentesEnergia));
console.log("tableroPadreId del tablero 'Casa' apunta a la fuente:", json.tableros[0].tableroPadreId === json.fuentesEnergia[0].id);

// Recargar y abrir el archivo
await page.reload({ waitUntil: "networkidle" });
await page.locator('input[type="file"]').setInputFiles(ruta);
await page.waitForTimeout(400);

// Tras abrir un proyecto, el tablero queda colapsado (solo se auto-expande al CREARLO) — lo expandimos a mano.
const editBtnCasa = page.locator('[aria-label="Editar tablero Casa"]');
await editBtnCasa.locator("xpath=..").click();
await page.waitForTimeout(200);

const textoTrasAbrir = await page.getByText(/Alimenta desde:/).textContent();
console.log("Tras abrir el archivo guardado, 'Alimenta desde':", textoTrasAbrir);

console.log("\nErrores de página:", errores);
await browser.close();
