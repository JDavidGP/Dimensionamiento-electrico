// Conmutación entre fuentes de energía — reescrito 2026-11-24 tras el
// rediseño de rol global (usuario, 2026-11-20, "ejemplo de las 3
// casas"): ya no existe un botón separado "+ Configurar conmutación
// entre fuentes" — el rol (principal/secundaria/auxiliar) se declara
// como propiedad GLOBAL de la fuente en "Declarar fuente de energía",
// y cada TABLERO elige (en su propio form de creación/edición) cuál
// fuente ya declarada juega de secundaria/auxiliar PARA ÉL, más el
// modo de conmutación y el horario — todo dentro del mismo form de
// "+ Nuevo tablero" / editar tablero, ver PanelTableros.jsx.
import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4328"), { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

// Secundaria/auxiliar de un tablero solo aparece fuera de Residencial básico.
await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Comercial / Industrial", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);

// --- 1. Declarar 2 fuentes con su rol global ---
const formCrearFuente = page.locator("form").filter({ has: page.getByPlaceholder("Ej: Red eléctrica local, Generador diesel 10kW") });

await formCrearFuente.getByPlaceholder("Ej: Red eléctrica local, Generador diesel 10kW").fill("Banco solar");
await formCrearFuente.getByRole("button", { name: "Batería", exact: true }).click();
await formCrearFuente.getByRole("button", { name: "Secundaria", exact: true }).click();
await formCrearFuente.getByRole("button", { name: "+ Crear fuente" }).click();
await page.waitForTimeout(200);

await formCrearFuente.getByPlaceholder("Ej: Red eléctrica local, Generador diesel 10kW").fill("Generador diesel");
await formCrearFuente.getByRole("button", { name: "Generador", exact: true }).click();
await formCrearFuente.getByRole("button", { name: "Auxiliar", exact: true }).click();
await formCrearFuente.getByRole("button", { name: "+ Crear fuente" }).click();
await page.waitForTimeout(200);
console.log("2 fuentes declaradas (Banco solar/secundaria, Generador diesel/auxiliar): OK");

// --- 2. Crear el tablero "Casa", eligiendo esas 2 fuentes para SU conmutación ---
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("Casa");

const formTablero = page.locator("form").filter({ has: page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina") });
const selectSecundaria = formTablero.locator("label", { hasText: "Fuente de energía — Secundaria" }).locator("xpath=..").locator("select");
const selectAuxiliar = formTablero.locator("label", { hasText: "Fuente de energía — Auxiliar" }).locator("xpath=..").locator("select");

await selectSecundaria.selectOption({ label: "Banco solar" });
await selectAuxiliar.selectOption({ label: "Generador diesel" });
await formTablero.getByRole("button", { name: "Por horario", exact: true }).click();

const inputsHora = formTablero.locator('input[type="time"]');
await inputsHora.nth(0).fill("06:00");
await inputsHora.nth(1).fill("18:00");
await formTablero.locator("label", { hasText: "Notas (opcional)" }).locator("xpath=..").locator("textarea").fill("Red de día, batería de noche, generador si falla todo");

await formTablero.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(300);
console.log("Tablero 'Casa' creado con secundaria/auxiliar/horario: OK");

// --- 3. Verificar el resumen en la tarjeta del tablero ---
const resumen = await page.getByText(/Por horario/).first().textContent();
console.log("Resumen de conmutación tras guardar:", resumen);
assert(/Banco solar/.test(resumen) && /secundaria/.test(resumen), "El resumen menciona 'Banco solar' como secundaria");
assert(/Generador diesel/.test(resumen) && /auxiliar/.test(resumen), "El resumen menciona 'Generador diesel' como auxiliar");
assert(/06:00.{1,3}18:00/.test(resumen), "El resumen muestra el horario 06:00–18:00");

// --- 4. Reabrir para editar y verificar que los valores se precargan ---
await page.getByRole("button", { name: "✎ Editar" }).click();
await page.waitForTimeout(200);
assert((await selectSecundaria.inputValue()) === (await selectSecundaria.locator('option:has-text("Banco solar")').getAttribute("value")), "La secundaria queda precargada como 'Banco solar' al reabrir");
const horaInicioTrasReabrir = await inputsHora.nth(0).inputValue();
assert(horaInicioTrasReabrir === "06:00", `La hora de inicio queda precargada (real: ${horaInicioTrasReabrir})`);

// --- 5. Quitar ambas fuentes (vuelve a "— Ninguna —") para "desactivar" la conmutación ---
await selectSecundaria.selectOption({ label: "— Ninguna —" });
await selectAuxiliar.selectOption({ label: "— Ninguna —" });
await formTablero.getByRole("button", { name: "Guardar cambios" }).click();
await page.waitForTimeout(300);
assert((await page.getByText(/Por horario/).count()) === 0, "Tras quitar ambas fuentes, el resumen de conmutación ya no aparece (activa=false)");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await page.screenshot({ path: DIR + "tmp/conmutacion_screenshot.png", fullPage: true });
await browser.close();
