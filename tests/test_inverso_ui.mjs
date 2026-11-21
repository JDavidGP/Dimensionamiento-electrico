import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage();
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

// --- 1. Crear un tablero SIN vincularlo a ningún nodo del diagrama ---
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("TD-SYNC");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(150);

// La tarjeta del tablero recién creado ya queda expandida automáticamente
// (setTableroActivoId en alGuardar) — no hace falta clickearla.
// InformeTecnico.jsx (pestaña siempre montada, ver TabsViewPager) también
// renderiza esta misma advertencia en su propia tabla de integridad — el
// locator sin acotar matchea las 2; .first() toma la de PanelTableros
// (la pestaña Tableros es la primera en el DOM), que es la que esta
// prueba realmente quiere verificar.
assert(
  await page.getByText("Sin representar en el diagrama unifilar").first().isVisible(),
  "Tablero recién creado (sin nodo en el diagrama) muestra la advertencia de representación"
);

// --- 2. Vincularlo desde el diagrama ---
const selectTipo = page.locator("select").filter({ has: page.locator('option:has-text("Acometida")') });
await selectTipo.selectOption({ label: "Tablero eléctrico" });
const selectVinculo = page.locator("select").filter({ has: page.locator('option:has-text("— Vincular a (opcional) —")') });
await selectVinculo.selectOption({ label: "TD-SYNC" });
await page.getByRole("button", { name: "+ Agregar", exact: true }).click();
await page.waitForTimeout(200);

assert(
  (await page.getByText("Sin representar en el diagrama unifilar").count()) === 0,
  "Tras vincular el tablero a un nodo del diagrama, la advertencia desaparece de la tabla"
);

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante el flujo");

await page.screenshot({ path: DIR + "tmp/inverso_resultado.png", fullPage: true });
await browser.close();
