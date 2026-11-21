// Diagrama unifilar embebido en la memoria técnica (usuario, 2026-11-20,
// "Fase 1" de la lista de pendientes de diagrama) — antes el informe no
// lo mostraba en absoluto.
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

// --- 1. Sin nodos: el informe dice "sin diagrama" explícitamente, no inventa nada ---
await page.getByRole("button", { name: "Informe técnico", exact: true }).click();
await page.waitForTimeout(300);
const informe = page.locator("#informe-memoria-tecnica");
assert(await informe.getByText("Sin diagrama unifilar cargado todavía.").isVisible(), "Sin nodos todavía, el informe lo dice explícitamente (no dibuja un SVG vacío)");
assert((await informe.locator("svg").count()) === 0, "No hay ningún <svg> en el informe mientras no hay nodos");

// --- 2. Crear un tablero + un nodo de diagrama vinculado ---
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("TD-PDF-TEST");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(150);

await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Diagrama unifilar", exact: true }).click();
await page.waitForTimeout(300);
const selectTipo = page.locator("select").filter({ has: page.locator('option:has-text("Acometida")') });
await selectTipo.selectOption({ label: "Tablero eléctrico" });
const selectVinculo = page.locator("select").filter({ has: page.locator('option:has-text("— Vincular a (opcional) —")') });
await selectVinculo.selectOption({ label: "TD-PDF-TEST" });
await page.getByRole("button", { name: "+ Agregar", exact: true }).click();
await page.waitForTimeout(200);

// --- 3. Ahora el informe técnico SÍ dibuja el diagrama, con el nombre vivo del tablero ---
await page.getByRole("button", { name: "Informe técnico", exact: true }).click();
await page.waitForTimeout(300);
assert((await informe.locator("svg").count()) === 1, "El informe ahora dibuja un <svg> del diagrama");
assert((await informe.locator("svg text", { hasText: "TD-PDF-TEST" }).count()) >= 1, "El nodo dibujado muestra el nombre vivo del tablero vinculado");

// --- 4. Paleta clara: el fondo del lienzo es blanco, no el oscuro del editor ---
const fondoSvg = await informe.locator("svg").evaluate((el) => getComputedStyle(el).backgroundColor);
assert(fondoSvg === "rgb(255, 255, 255)", `El lienzo del diagrama embebido usa fondo blanco, no el oscuro del editor (real: ${fondoSvg})`);

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await page.screenshot({ path: DIR + "tmp/diagrama_en_pdf.png", fullPage: true });
await browser.close();
