// Factor de ajuste por agrupamiento (NEC 310.15(B)(2)(a)) + instalación
// enterrada (NEC 300.5) conectados a la UI — usuario, 2026-11-25,
// "empecemos a construir" (canalizaciones aéreas y subterráneas).
// Ambos viven dentro del bloque "Llenado de conducto" ya existente
// (ver BloqueLlenadoConducto en PanelTableros.jsx): reusan el mismo
// grupo de circuitos que el usuario ya marca ahí, no se pide de nuevo.
import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto(process.env.BASE_URL || "http://localhost:4343", { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("TD-CCC");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(300);

await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);

async function crearCircuitoConEquipo(nombre, potenciaW) {
  await page.getByPlaceholder("Ej: Iluminación cocina").fill(nombre);
  await page.locator("label:has-text('Distancia (m)')").locator("..").locator("input").fill("10");
  await page.getByRole("button", { name: "+ Crear circuito" }).click();
  await page.waitForTimeout(150);
  await page.getByPlaceholder("Ej: Refrigerador").fill("Carga");
  await page.locator("label:has-text('P unitaria (W)')").locator("..").locator("input").fill(String(potenciaW));
  await page.getByRole("button", { name: "+ Agregar equipo" }).click();
  await page.waitForTimeout(150);
}

await crearCircuitoConEquipo("Circuito A", 1200);
await crearCircuitoConEquipo("Circuito B", 1800);

const selectsTablero = page.getByRole("combobox", { name: /^Tablero de/ });
const cantidadSelects = await selectsTablero.count();
for (let i = 0; i < cantidadSelects; i++) {
  await selectsTablero.nth(i).selectOption({ label: "TD-CCC" });
}
await page.waitForTimeout(200);

await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);

const checkboxes = page.locator("label", { hasText: /Circuito [AB]/ }).locator('input[type="checkbox"]');
assert((await page.getByText(/conductores portadores de corriente/).count()) === 0, "Sin ningún circuito marcado, no muestra CCC inventados");

await checkboxes.nth(0).check();
await checkboxes.nth(1).check();
await page.waitForTimeout(200);

// 2 circuitos monofásicos = 2 CCC cada uno (fase+neutro) = 4 CCC → factor 80% (rango 4-6 de la tabla)
assert((await page.getByText(/4 conductores portadores de corriente agrupados/).count()) >= 1, "Suma correctamente los CCC de los 2 circuitos monofásicos marcados (2+2=4)");
assert((await page.getByText(/factor de ajuste de ampacidad: 80%/).count()) >= 1, "Aplica el factor correcto de la tabla 310.15(B)(2)(a) para 4-6 CCC");

await checkboxes.nth(0).uncheck();
await page.waitForTimeout(200);
assert((await page.getByText(/2 conductores portadores de corriente agrupados/).count()) >= 1, "Al desmarcar uno, recalcula a 2 CCC (no queda pegado al valor anterior)");
assert((await page.getByText(/sin reducción/).count()) >= 1, "Con 2 CCC (≤3) la regla todavía no aplica — sin reducción");

await checkboxes.nth(0).check();
await page.waitForTimeout(150);

// --- Instalación enterrada (NEC 300.5) ---
assert((await page.getByText("¿Este tubo va enterrado? (NEC 300.5)").count()) === 1, "Existe el toggle de instalación enterrada, dentro del mismo bloque");
assert((await page.getByText(/Profundidad mínima exigida:/).count()) === 0, "Cerrado por defecto — no muestra el detalle sin que el usuario lo pida");

await page.getByText("¿Este tubo va enterrado? (NEC 300.5)").click();
await page.waitForTimeout(150);
const textoDefault = await page.getByText(/Profundidad mínima exigida:/).textContent();
assert(textoDefault.includes('18"'), `Por defecto (PVC, ubicación general): exige 18in — Tabla 300.5 (real: '${textoDefault}')`);

await page.getByPlaceholder("Profundidad real (in)").fill("12");
await page.waitForTimeout(150);
assert((await page.getByText("⚠ No alcanza la profundidad mínima.").count()) === 1, "12in medidos no alcanzan el mínimo de 18in exigido");

await page.getByPlaceholder("Profundidad real (in)").fill("20");
await page.waitForTimeout(150);
assert((await page.getByText("✓ Cumple.").count()) === 1, "20in medidos sí cumplen el mínimo de 18in exigido");

assert((await page.getByText(/wet location/).count()) >= 1, "Recuerda el requisito de aislamiento THWN-2 (300.5(B)) para todo enterrado");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/ccc_enterrado_nec_ui.png", fullPage: true });
await browser.close();
