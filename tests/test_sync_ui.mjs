import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
page.on("console", (msg) => { if (msg.type() === "error") errores.push(msg.text()); });
page.on("response", (r) => { if (r.status() === 404) console.log("404 URL:", r.url()); });

await page.goto((process.env.BASE_URL || "http://localhost:4343"), { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

// --- 1. Crear un tablero real en la tabla ---
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("TD-TEST");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(200);
assert(await page.getByText("TD-TEST").first().isVisible(), "Tablero TD-TEST creado y visible en la tabla");

// --- 2. En el diagrama: agregar un nodo de tipo tablero_electrico vinculado a TD-TEST ---
const selectTipo = page.locator("select").filter({ has: page.locator('option:has-text("Acometida")') });
await selectTipo.selectOption({ label: "Tablero eléctrico" });
await page.locator('input[placeholder="Nombre (ej. Q1, TD-01)"]').fill("Nodo-TD1");

const selectVinculo = page.locator("select").filter({ has: page.locator('option:has-text("— Vincular a (opcional) —")') });
assert(await selectVinculo.locator('option:has-text("TD-TEST")').count() === 1, 'El selector "Vincular a" ofrece TD-TEST como candidato');
await selectVinculo.selectOption({ label: "TD-TEST" });

await page.getByRole("button", { name: "+ Agregar", exact: true }).click();
await page.waitForTimeout(150);

// El nodo debe mostrar el NOMBRE VIVO de la entidad (TD-TEST), no "Nodo-TD1"
const svgTextos = await page.locator("svg text").allTextContents();
assert(svgTextos.includes("TD-TEST"), 'El nodo muestra el nombre vivo de la entidad vinculada ("TD-TEST"), no el nombre propio del nodo');
assert(svgTextos.some((t) => t.includes("vinculado")), 'El subtítulo del nodo indica "vinculado"');
assert(!svgTextos.includes("Nodo-TD1"), "El nombre propio del nodo (fallback) NO se muestra mientras está vinculado");

// --- 3. Crear un segundo nodo del mismo tipo: TD-TEST ya no debe aparecer como candidato (relación 1 a 1) ---
await selectTipo.selectOption({ label: "Tablero eléctrico" });
const selectVinculo2 = page.locator("select").filter({ has: page.locator('option:has-text("— Vincular a (opcional) —")') });
assert(
  await selectVinculo2.locator('option:has-text("TD-TEST")').count() === 0,
  "TD-TEST ya no aparece como candidato tras vincularse (evita vincular la misma entidad dos veces)"
);

// --- 4. Eliminar el tablero TD-TEST desde la tabla: el nodo debe quedar DESVINCULADO, no desaparecer ---
await page.getByRole("button", { name: "Eliminar tablero TD-TEST" }).click();
await page.waitForTimeout(200);
assert(!(await page.getByText("TD-TEST").count()), "TD-TEST ya no existe en la tabla de tableros");

const svgTextosTrasBorrar = await page.locator("svg text").allTextContents();
assert(
  svgTextosTrasBorrar.includes("Nodo-TD1"),
  "Tras borrar la entidad vinculada, el nodo NO desaparece y vuelve a mostrar su propio nombre (Nodo-TD1)"
);
assert(!svgTextosTrasBorrar.includes("TD-TEST"), "El nombre de la entidad borrada ya no se muestra (no quedó una referencia fantasma)");
assert(!svgTextosTrasBorrar.some((t) => t.includes("vinculado")), 'El subtítulo ya no dice "vinculado" tras desvincularse automáticamente');

console.log("\nErrores de página/consola:", errores);
assert(errores.length === 0, "Sin errores de consola/página durante todo el flujo");

await page.screenshot({ path: DIR + "tmp/sync_resultado.png", fullPage: true });
await browser.close();
