import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4343"), { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "NEC ▾" }).click();
await page.getByRole("button", { name: "IEC", exact: true }).click();
await page.getByRole("button", { name: "Validar", exact: true }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);

await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("Edificio Grado");
await page.getByPlaceholder("Desde el origen").fill("20");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: "+ Activar simultaneidad de viviendas (edificio REBT)" }).click();
await page.getByRole("button", { name: "Guardar", exact: true }).first().click();
await page.waitForTimeout(200);

await page.getByRole("button", { name: "+ Subtablero" }).first().click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("Depto Grado 1");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(300);

// Depto Grado 1 queda expandido tras crearse
assert(
  await page.getByText("Grado de electrificación de esta vivienda").isVisible(),
  "El selector de grado de electrificación aparece en un hijo directo de un edificio REBT activo"
);

await page.getByRole("button", { name: "Elevada (9200W)", exact: true }).click();
await page.waitForTimeout(200);

await page.getByText("Edificio Grado", { exact: true }).first().click();
await page.waitForTimeout(300);
assert(
  await page.getByText(/1 vivienda · coeficiente 1 · carga 9\.20kW/).isVisible(),
  "Con grado Elevada elegido en la única vivienda, la carga REBT usa 9200W (no el básico 5750W por defecto)"
);

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página");
await browser.close();
