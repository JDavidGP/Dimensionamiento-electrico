// Guardar/abrir desde la barra principal (BarraProyecto) — usuario,
// 2026-11-22: "quiero que el empaquetado... guarde en PDF en vez de
// json". El botón principal ahora guarda .pdf; el botón secundario
// ".json" sigue disponible para quien prefiera el formato de antes.
// Prueba los 2 caminos de guardado y que ambos se puedan reabrir.
import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto(process.env.BASE_URL || "http://localhost:4343", { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

const barra = page.locator("label", { hasText: "Abrir" }).locator("xpath=..");
await barra.locator('input').first().fill("Proyecto de prueba PDF");

// --- 1. Guardar (.pdf) — el botón principal ---
const [descargaPdf] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "↓ Guardar (.pdf)", exact: true }).click(),
]);
assert(descargaPdf.suggestedFilename().endsWith(".pdf"), `El botón principal descarga un .pdf (real: "${descargaPdf.suggestedFilename()}")`);
const rutaPdf = DIR + "tmp/persistencia_formatos.pdf";
await descargaPdf.saveAs(rutaPdf);
assert(await page.getByText("Guardado como").isVisible(), "Se muestra el aviso de guardado tras descargar el PDF");
await page.waitForTimeout(200);

// --- 2. Guardar (.json) — el botón secundario ---
const [descargaJson] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: ".json", exact: true }).click(),
]);
assert(descargaJson.suggestedFilename().endsWith(".json"), `El botón secundario descarga un .json (real: "${descargaJson.suggestedFilename()}")`);
const rutaJson = DIR + "tmp/persistencia_formatos.json";
await descargaJson.saveAs(rutaJson);

// --- 3. Nuevo proyecto, reabrir el .pdf ---
await page.getByRole("button", { name: "+ Nuevo", exact: true }).click();
await page.waitForTimeout(150);
await barra.locator('input[type="file"]').setInputFiles(rutaPdf);
await page.waitForTimeout(300);
assert((await page.locator('input[value="Proyecto de prueba PDF"]').count()) >= 1, "Reabrir el .pdf restaura el nombre del proyecto");
assert(errores.length === 0, "Sin errores de página al reabrir el .pdf");

// --- 4. Nuevo proyecto, reabrir el .json (compatibilidad hacia atrás) ---
await page.getByRole("button", { name: "+ Nuevo", exact: true }).click();
await page.waitForTimeout(150);
await barra.locator('input[type="file"]').setInputFiles(rutaJson);
await page.waitForTimeout(300);
assert((await page.locator('input[value="Proyecto de prueba PDF"]').count()) >= 1, "Reabrir el .json de siempre sigue funcionando (compatibilidad)");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await browser.close();
