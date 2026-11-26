// "Carga continua" — auditoría 2026-11-26. Había 2 checkboxes con casi
// el mismo nombre: uno en FormularioCircuito.jsx (form.continua) que
// NUNCA se guardaba a ningún lado (fantasma), y el campo REAL
// (esCargaContinua, ×1.25 NEC 210.19 — ver factorDemanda.ts) que SÍ
// tenía todo el pass-through de datos pero ningún checkbox que lo
// editara (inalcanzable desde la UI). Se quitó el fantasma del circuito
// y se agregó el checkbox real al EQUIPO. Verifica en vivo que: (1) el
// fantasma ya no existe en el formulario de circuito, (2) el checkbox
// real del equipo persiste al guardar y reabrir para editar.
import { chromium } from "playwright";

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto(process.env.BASE_URL || "http://localhost:4343", { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);

// --- 1. El fantasma ya no existe en el formulario de circuito ---
assert((await page.getByText("Carga continua (>3 horas)", { exact: true }).count()) === 0, "El checkbox fantasma 'Carga continua (>3 horas)' ya no existe en FormularioCircuito");

// --- 2. Crear circuito + equipo, marcar 'Carga continua' en el EQUIPO ---
await page.getByPlaceholder("Ej: Iluminación cocina").fill("Circuito carga continua test");
await page.locator("label", { hasText: "Distancia (m)" }).locator("xpath=following-sibling::input[1]").fill("10");
await page.getByRole("button", { name: "+ Crear circuito" }).click();
await page.waitForTimeout(200);

await page.getByPlaceholder("Ej: Refrigerador").fill("Motor continuo test");
await page.locator("label", { hasText: "P unitaria (W)" }).locator("xpath=following-sibling::input[1]").fill("500");
const checkboxCargaContinua = page.getByText(/Carga continua \(>3 horas, ×1\.25/);
assert(await checkboxCargaContinua.isVisible(), "El checkbox REAL 'Carga continua (×1.25 — Art. 210.19)' es visible en el formulario de EQUIPO");
await checkboxCargaContinua.click();
await page.getByRole("button", { name: "+ Agregar equipo" }).click();
await page.waitForTimeout(250);

// --- 3. Reabrir ese equipo para editar: el checkbox sigue marcado (persistió) ---
await page.getByRole("button", { name: "Editar Motor continuo test", exact: true }).click();
await page.waitForTimeout(200);
const checkboxInput = page.locator("label", { hasText: "Carga continua" }).locator('input[type="checkbox"]');
assert(await checkboxInput.isChecked(), "Tras guardar y reabrir para editar, 'Carga continua' sigue marcado — el dato persistió de verdad");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await browser.close();
