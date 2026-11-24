// Llenado de conducto conectado a la UI (NEC Cap. 9) — usuario,
// 2026-11-24, "conectar la tabla NEC". El motor (App.motor.llenadoConducto,
// ver modules/motor/canalizacion.ts) existía desde antes pero no lo
// llamaba ningún componente. Se conecta dentro de cada tablero: el
// calibre de cada circuito se reusa del cálculo ya hecho
// (resultado.seccion), nunca se reingresa a mano.
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
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("TD-Conducto");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(300);

assert((await page.getByText(/Llenado de conducto/).count()) === 0, "Sin circuitos todavía, el bloque no aparece (nada que agrupar)");

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
  await selectsTablero.nth(i).selectOption({ label: "TD-Conducto" });
}
await page.waitForTimeout(200);

await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);

assert((await page.getByText(/Llenado de conducto \(NEC Cap\. 9\)/).count()) >= 1, "El bloque aparece con circuitos asignados y calculados");
assert((await page.getByText(/Circuito A/).count()) >= 1, "Lista 'Circuito A' con su AWG real (reusado del cálculo, no reingresado)");
assert((await page.getByText(/Circuito B/).count()) >= 1, "Lista 'Circuito B' con su AWG real");
assert((await page.getByText(/Tamaño mínimo:/).count()) === 0, "Sin ningún circuito marcado todavía, no muestra un resultado inventado");

const checkboxes = page.locator("label", { hasText: /Circuito [AB]/ }).locator('input[type="checkbox"]');
await checkboxes.nth(0).check();
await checkboxes.nth(1).check();
await page.waitForTimeout(200);

const textoResultado = await page.getByText(/Tamaño mínimo:/).first().textContent();
assert(/EMT|PVC_SCH40/.test(textoResultado), `El resultado calcula un tamaño real para los 2 circuitos marcados (real: '${textoResultado}')`);

// Desmarcar uno: el resultado se recalcula (no queda pegado al anterior)
await checkboxes.nth(0).uncheck();
await page.waitForTimeout(200);
const textoUnSolo = await page.getByText(/Tamaño mínimo:/).first().textContent();
assert(textoUnSolo.includes("1 conductor"), `Con 1 solo circuito marcado, el resultado se recalcula para 1 conductor (real: '${textoUnSolo}')`);

// Bajo REBT (IEC_ES) el bloque no aparece — esa normativa usa un método propio (ITC-BT-21), sin UI todavía
await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "NEC ▾" }).click();
await page.getByRole("button", { name: "IEC", exact: true }).click();
await page.getByRole("button", { name: "Validar", exact: true }).click();
await page.waitForTimeout(200);
const botonContinuar = page.getByRole("button", { name: "Continuar y recalcular", exact: true });
if (await botonContinuar.count()) {
  await botonContinuar.click();
  await page.waitForTimeout(200);
}
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);
assert((await page.getByText(/Llenado de conducto/).count()) === 0, "Bajo REBT (IEC_ES), el bloque no aparece (sin tabla de canalizaciones todavía)");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/llenado_conducto_ui.png", fullPage: true });
await browser.close();
