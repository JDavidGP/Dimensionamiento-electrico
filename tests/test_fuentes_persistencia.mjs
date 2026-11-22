import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4326"), { waitUntil: "networkidle" });

// Ya no hay mini-formulario inline en el form de tablero (usuario,
// 2026-11-22: lo eliminó por duplicado/confuso) — se crea en el panel
// "Declarar fuente de energía" y se elige a mano como origen.
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("Casa");

const formCrearFuente = page.locator("form").filter({ has: page.getByPlaceholder("Ej: Red eléctrica local, Generador diesel 10kW") });
await formCrearFuente.getByPlaceholder("Ej: Red eléctrica local, Generador diesel 10kW").fill("Banco solar 5kWh");
await formCrearFuente.getByRole("button", { name: "Batería", exact: true }).click();
await formCrearFuente.getByRole("button", { name: "Principal", exact: true }).click();
await formCrearFuente.getByRole("button", { name: "+ Crear fuente" }).click();
await page.waitForTimeout(200);

await page
  .locator("label")
  .filter({ hasText: /^Fuente de energía — Principal/ })
  .locator("xpath=following-sibling::select[1]")
  .selectOption({ label: "Banco solar 5kWh (Batería)" });

await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(300);

const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "↓ Guardar (.pdf)", exact: true }).click(),
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
