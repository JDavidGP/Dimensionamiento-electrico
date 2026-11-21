import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4327"), { waitUntil: "networkidle" });

// 1. Crear un tablero, y usar el enlace "+ Nueva fuente de energía" para crear un Generador diesel auxiliar como su origen
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("Sub Taller");

await page.getByText("+ Nueva fuente de energía (Batería/Generador)").click();
await page.getByPlaceholder("Ej: Banco de baterías solar, Generador diesel 10kW").fill("Generador diesel 10kW");
await page.locator("form").getByRole("button", { name: "Generador", exact: true }).click();
await page.locator("form").getByRole("button", { name: "Auxiliar", exact: true }).click();
await page.getByRole("button", { name: "+ Crear y usar como origen" }).click();

// Verificar que el <select> de origen ahora tiene seleccionada esa fuente
const valorSelect = await page.locator("form select").first().inputValue();
const textoOpcionSeleccionada = await page.locator(`form select option[value="${valorSelect}"]`).textContent();
console.log("Fuente seleccionada automáticamente como origen tras crearla:", textoOpcionSeleccionada);

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
