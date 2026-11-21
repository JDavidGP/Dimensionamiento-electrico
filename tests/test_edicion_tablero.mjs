import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto((process.env.BASE_URL || "http://localhost:4340"), { waitUntil: "networkidle" });

// Crear un tablero tri a 480V (NEC, pill estándar)
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("T480");
await page.locator("form").getByRole("button", { name: "Tri", exact: true }).click();
await page.locator("form").getByRole("button", { name: "480V", exact: true }).click();
await page.getByRole("button", { name: "+ Crear tablero" }).click();

// Reabrir en edición y verificar que la pill 480V queda marcada activa (no "Manual")
await page.locator('[aria-label="Editar tablero T480"]').click();
const activo480 = await page.locator("form").getByRole("button", { name: "480V", exact: true }).evaluate(el => getComputedStyle(el).cursor);
const manualActivoFalso = await page.locator("form").getByRole("button", { name: "Manual" }).evaluate(el => el.style.background);
console.log("Al reabrir T480 en edición, background del botón Manual (debería ser vacío/transparent, no activo):", manualActivoFalso);
const inputManualVisibleT480 = await page.getByPlaceholder("Tensión del alimentador (V)").count();
console.log("Input manual visible al reabrir T480 (debería ser 0, matchea pill estándar):", inputManualVisibleT480);
await page.locator("form").getByRole("button", { name: "Cancelar", exact: true }).click();

// Crear un tablero con tensión manual atípica (ej. 600V)
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("TAtipico");
await page.locator("form").getByRole("button", { name: "Manual" }).click();
await page.getByPlaceholder("Tensión del alimentador (V)").fill("600");
await page.getByRole("button", { name: "+ Crear tablero" }).click();

// Reabrir en edición: debería mostrar "Manual" activo con 600 precargado, SIN resetear el valor
await page.locator('[aria-label="Editar tablero TAtipico"]').click();
const inputManualVisibleAtipico = await page.getByPlaceholder("Tensión del alimentador (V)").count();
const valorPreservado = inputManualVisibleAtipico ? await page.getByPlaceholder("Tensión del alimentador (V)").inputValue() : null;
console.log("Al reabrir TAtipico, input manual visible:", inputManualVisibleAtipico, "valor preservado:", valorPreservado);

await browser.close();
