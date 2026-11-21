import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4343"), { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

// --- 0. Pasar a instalación comercial/industrial (el panel de Transformadores está gateado a ese nivel) ---
await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(350);
await page.getByRole("button", { name: "Comercial / Industrial", exact: true }).click();
await page.waitForTimeout(150);

await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(350);

assert(await page.getByText("Transformadores", { exact: true }).isVisible(), "El panel propio de Transformadores aparece en instalación comercial/industrial");

// --- 1. Crear desde el panel propio (no desde el atajo inline del tablero) ---
await page.getByRole("button", { name: "+ Nuevo transformador" }).click();
await page.getByPlaceholder("Ej: Transformador reductor 480V→240V").fill("TR-PANEL-TEST");
await page.getByRole("button", { name: "Tri", exact: true }).first().click();
await page.getByPlaceholder("Ej: 480").fill("480");
await page.getByPlaceholder("Ej: 240").fill("240");
await page.getByRole("button", { name: "+ Crear transformador" }).click();
await page.waitForTimeout(200);

// .first(): InformeTecnico.jsx (pestaña siempre montada) también lista
// transformadores con un texto que contiene el mismo nombre.
assert(await page.getByText("TR-PANEL-TEST").first().isVisible(), "El transformador creado aparece en la lista");
assert(await page.getByText("Sin representar en el diagrama unifilar").first().isVisible(), "Transformador recién creado (sin nodo) muestra la advertencia (tarjeta auto-expandida)");
assert(await page.getByText("tri · 480V→240V").first().isVisible(), "La tarjeta colapsada muestra fases y tensiones");

// --- 2. Editar ---
await page.getByRole("button", { name: "Editar transformador TR-PANEL-TEST" }).click();
await page.waitForTimeout(150);
const inputNombre = page.getByPlaceholder("Ej: Transformador reductor 480V→240V");
await inputNombre.fill("TR-PANEL-EDITADO");
await page.getByRole("button", { name: "Guardar cambios" }).click();
await page.waitForTimeout(200);
assert(await page.getByText("TR-PANEL-EDITADO").first().isVisible(), "El nombre editado se refleja en la lista");
assert((await page.getByText("TR-PANEL-TEST", { exact: true }).count()) === 0, "El nombre anterior ya no aparece");

// --- 3. Vincularlo desde el diagrama y confirmar que la advertencia desaparece ---
await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Diagrama unifilar", exact: true }).click();
await page.waitForTimeout(350);
const selectTipo = page.locator("select").filter({ has: page.locator('option:has-text("Acometida")') });
await selectTipo.selectOption({ label: "Transformador" });
const selectVinculo = page.locator("select").filter({ has: page.locator('option:has-text("— Vincular a (opcional) —")') });
assert((await selectVinculo.locator('option:has-text("TR-PANEL-EDITADO")').count()) === 1, "El transformador editado aparece como candidato para vincular");
await selectVinculo.selectOption({ label: "TR-PANEL-EDITADO" });
await page.getByRole("button", { name: "+ Agregar", exact: true }).click();
await page.waitForTimeout(200);

await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(350);
assert((await page.getByText("Sin representar en el diagrama unifilar").count()) === 0, "Tras vincularlo, la advertencia desaparece del panel de transformadores");

// --- 4. Eliminar ---
await page.getByRole("button", { name: "Eliminar transformador TR-PANEL-EDITADO" }).click();
await page.waitForTimeout(200);
assert((await page.getByText("TR-PANEL-EDITADO").count()) === 0, "El transformador eliminado ya no aparece en la lista");

// --- 5. Volver a residencial básico: el panel de Transformadores desaparece de nuevo ---
await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(350);
await page.getByRole("button", { name: "Residencial básico", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(350);
assert((await page.getByText("Transformadores", { exact: true }).count()) === 0, "(residencial básico) El panel de Transformadores vuelve a ocultarse");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await page.screenshot({ path: DIR + "tmp/panel_transformadores.png", fullPage: true });
await browser.close();
