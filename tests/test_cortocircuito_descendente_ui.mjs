// Cortocircuito más allá de los bornes del transformador, en la UI
// real — usuario, 2026-11-21, documento "tabla completa X/R
// aceite/seco": TableroMediator.cortocircuitoDesdeTablero, campo
// "Tipo" (aceite/seco) en PanelTransformadores, bloque "Icc en este
// tablero" en PanelTableros. No repite la exactitud numérica (ya
// probada en test_cortocircuito_descendente.mjs a nivel mediador) —
// confirma que la UI real muestra el resultado, con los campos reales.
import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1300 } });
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

// --- 0. Comercial/industrial + IEC_ES ---
await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(250);
await page.getByRole("button", { name: "Comercial / Industrial", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "NEC ▾" }).click();
await page.getByRole("button", { name: "IEC", exact: true }).click();
await page.getByRole("button", { name: "Validar", exact: true }).click();
await page.waitForTimeout(250);

await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);

// --- 1. Crear el transformador con datos completos (incluye el nuevo campo "Tipo") ---
await page.getByRole("button", { name: "+ Nuevo transformador" }).click();
await page.getByPlaceholder("Ej: Transformador reductor 480V→240V").fill("TR-DESC");
await page.getByRole("button", { name: "Tri", exact: true }).first().click();
await page.getByPlaceholder("Ej: 480").fill("13800");
await page.getByPlaceholder("Ej: 240").fill("400");
await page.getByPlaceholder("Ej: 75").fill("500");
await page.getByPlaceholder("Ej: 4", { exact: true }).fill("4");
await page.getByRole("button", { name: "Aceite", exact: true }).click();
await page.getByRole("button", { name: "+ Crear transformador" }).click();
await page.waitForTimeout(250);

assert(await page.getByText(/Icc en bornes del transformador/).isVisible(), "El transformador ya calcula su Icc en bornes (500kVA/400V/%Z=4%)");

// --- 2. Crear un tablero usando ese transformador como origen (dropdown, no el atajo inline) ---
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("TD-DESC");
const selectOrigen = page.locator("select").filter({ has: page.locator('option:has-text("TR-DESC")') });
await selectOrigen.selectOption({ label: "TR-DESC (tri · 13800V→400V)" });
await page.waitForTimeout(150);
await page.getByPlaceholder("Desde la fuente de energía").fill("25");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(250);

assert(await page.getByText(/TR-DESC \(Transformador/).first().isVisible(), "El tablero TD-DESC cuelga del transformador TR-DESC");

// --- 3. Sin circuitos todavía: el bloque de cortocircuito pendiente (falta alimentador propio para calcular) ---
assert(
  await page.getByText(/Cortocircuito \(transformador propio\) pendiente/).isVisible(),
  "Sin circuitos en el tablero, el cortocircuito queda pendiente (no inventa un resultado)"
);

// --- 4. Agregar un circuito con equipo al tablero, para que el alimentador se complete ---
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Ej: Iluminación cocina").fill("Carga TD-DESC");
await page.getByRole("button", { name: "Tri", exact: true }).first().click();
await page.locator("label:has-text('Distancia (m)')").locator("..").locator("input").fill("15");
await page.getByRole("button", { name: "+ Crear circuito" }).click();
await page.waitForTimeout(200);

// Asignar el circuito recién creado al tablero TD-DESC (selector de tablero en la tarjeta del circuito).
await page.getByLabel("Tablero de Carga TD-DESC").selectOption({ label: "TD-DESC" });
await page.waitForTimeout(150);

// Agregar un equipo al circuito (formulario de equipo).
await page.getByPlaceholder("Ej: Refrigerador").fill("Carga de prueba");
await page.locator("label:has-text('P unitaria (W)')").locator("..").locator("input").fill("5000");
await page.getByRole("button", { name: "+ Agregar equipo" }).click();
await page.waitForTimeout(250);

await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);
// La tarjeta del tablero queda auto-expandida desde su creación (ver
// setTableroActivoId en PanelTableros.jsx) — NO hace falta un click
// extra acá (y uno extra la COLAPSARÍA, en vez de abrirla).

const textoIccTablero = await page.getByText(/Icc en este tablero/).textContent();
assert(/kA/.test(textoIccTablero), `El tablero TD-DESC muestra su Icc real vía el transformador propio (real: '${textoIccTablero}')`);
assert(!/xrDisponible/.test(textoIccTablero), "No muestra el campo interno 'xrDisponible', solo el texto legible");

await page.screenshot({ path: DIR + "tmp/cortocircuito_descendente.png", fullPage: true });

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await browser.close();
