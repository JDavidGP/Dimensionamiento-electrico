import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4327"), { waitUntil: "networkidle" });

// 1. Crear un tablero, y declarar un Generador diesel en el panel
// "Declarar fuente de energía" (ya no hay mini-formulario inline en el
// form de tablero — usuario, 2026-11-22, lo eliminó por duplicado/
// confuso), luego elegirlo a mano como origen del tablero.
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("Sub Taller");

const formCrearFuente = page.locator("form").filter({ has: page.getByPlaceholder("Ej: Red eléctrica local, Generador diesel 10kW") });
await formCrearFuente.getByPlaceholder("Ej: Red eléctrica local, Generador diesel 10kW").fill("Generador diesel 10kW");
await formCrearFuente.getByRole("button", { name: "Generador", exact: true }).click();
await formCrearFuente.getByRole("button", { name: "Auxiliar", exact: true }).click();
await formCrearFuente.getByRole("button", { name: "+ Crear fuente" }).click();
await page.waitForTimeout(200);

const selectPrincipal = page
  .locator("label")
  .filter({ hasText: /^Fuente de energía — Principal/ })
  .locator("xpath=following-sibling::select[1]");
await selectPrincipal.selectOption({ label: "Generador diesel 10kW (Generador)" });

// Verificar que el <select> de origen quedó con esa fuente elegida
const valorSelect = await selectPrincipal.inputValue();
const textoOpcionSeleccionada = await selectPrincipal.locator(`option[value="${valorSelect}"]`).textContent();
console.log("Fuente elegida como origen:", textoOpcionSeleccionada);

await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(300);

// 2. Verificar el texto "Alimenta desde" en el tablero recién creado (ya debería estar expandido)
const textoAlimentaDesde = await page.getByText(/Alimenta desde:/).textContent();
console.log("Texto 'Alimenta desde':", textoAlimentaDesde);

// 3. Verificar que el punto de estado NO sea rojo (no hay "referencia inexistente")
const puntoEstado = page.locator('div[style*="border-radius: 50%"]').first();
const colorPunto = await puntoEstado.evaluate(el => getComputedStyle(el).backgroundColor);
console.log("Color del punto de estado del tablero (no debería ser el de error, rgb(222, 107, 80)):", colorPunto);

// 4. Crear un segundo tablero y verificar que la fuente ya creada aparece listada en el <optgroup> "Fuentes de energía"
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
const opcionesGrupo = await page.locator('form select optgroup[label="Fuentes de energía"] option').allTextContents();
console.log("Fuentes listadas en el optgroup para el segundo tablero:", opcionesGrupo);
await page.getByRole("button", { name: "Cancelar", exact: true }).click();

console.log("\nErrores de página:", errores);
await browser.close();
