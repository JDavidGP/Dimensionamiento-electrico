import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4352"), { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

// --- 0. Crear un circuito con un equipo (sin vincular a diagrama ni plano) ---
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(200);

assert((await page.getByText("Representar en", { exact: true }).count()) === 1, "El formulario de circuito muestra el campo 'Representar en'");
const selectRepresentacion = page.locator("select").filter({ has: page.locator('option:has-text("Diagrama y plano")') });
assert((await selectRepresentacion.inputValue()) === "ambos", "Por defecto, un circuito nuevo se representa 'ambos' (diagrama y plano)");

await page.getByPlaceholder("Ej: Iluminación cocina").fill("Circuito de prueba");
await page.locator("label", { hasText: "Distancia (m)" }).locator("xpath=following-sibling::input[1]").fill("10");
await page.getByRole("button", { name: "+ Crear circuito" }).click();
await page.waitForTimeout(200);

await page.getByPlaceholder("Ej: Refrigerador").fill("Lámpara de prueba");
await page.locator("label", { hasText: "P unitaria (W)" }).locator("xpath=following-sibling::input[1]").fill("40");
await page.getByRole("button", { name: "+ Agregar equipo" }).click();
await page.waitForTimeout(200);

// --- 1. Con representacion='ambos' (default), advierte en los DOS lados ---
assert((await page.getByText(/sin representar en el diagrama unifilar/).count()) >= 1, "Con 'Diagrama y plano' (default), advierte sobre el diagrama");
assert((await page.getByText(/sin representar en el plano/).count()) >= 1, "Con 'Diagrama y plano' (default), TAMBIÉN advierte sobre el plano");

// --- 2. Cambiar a "Solo plano" — la advertencia del diagrama debe desaparecer, la del plano se mantiene ---
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(150);
// Editar el circuito recién creado para cambiar su representación.
await page.getByRole("button", { name: "Editar circuito Circuito de prueba" }).click();
await page.waitForTimeout(200);
await selectRepresentacion.selectOption({ label: "Solo plano" });
await page.getByRole("button", { name: "Guardar cambios" }).click();
await page.waitForTimeout(200);

assert((await page.getByText(/sin representar en el diagrama unifilar/).count()) === 0, "Con 'Solo plano', YA NO advierte sobre el diagrama");
assert((await page.getByText(/sin representar en el plano/).count()) >= 1, "Con 'Solo plano', SIGUE advirtiendo sobre el plano");

// --- 3. Cambiar a "Ninguno" — ninguna advertencia de representación ---
await page.getByRole("button", { name: "Editar circuito Circuito de prueba" }).click();
await page.waitForTimeout(200);
await selectRepresentacion.selectOption({ label: "Ninguno" });
await page.getByRole("button", { name: "Guardar cambios" }).click();
await page.waitForTimeout(200);

assert((await page.getByText(/sin representar en el diagrama unifilar/).count()) === 0, "Con 'Ninguno', no advierte sobre el diagrama");
assert((await page.getByText(/sin representar en el plano/).count()) === 0, "Con 'Ninguno', no advierte sobre el plano");

// --- 4. La preferencia persiste al guardar y reabrir el proyecto ---
const [descarga] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "↓ Guardar (.pdf)" }).click(),
]);
const rutaDescargada = DIR + "tmp/representacion_circuito.pdf";
await descarga.saveAs(rutaDescargada);
await page.waitForTimeout(200);

await page.reload({ waitUntil: "networkidle" });
await page.locator("label", { hasText: "Abrir" }).locator('input[type="file"]').setInputFiles(rutaDescargada);
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: "Editar circuito Circuito de prueba" }).click();
await page.waitForTimeout(200);
const selectRepresentacionTrasReabrir = page.locator("select").filter({ has: page.locator('option:has-text("Diagrama y plano")') });
assert((await selectRepresentacionTrasReabrir.inputValue()) === "ninguno", "La preferencia 'Ninguno' persiste tras guardar y reabrir el proyecto");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/representacion_circuito.png", fullPage: true });
await browser.close();
