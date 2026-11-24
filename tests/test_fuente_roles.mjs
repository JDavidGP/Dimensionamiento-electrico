import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4352"), { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

// --- 1. Crear 2 fuentes de energía (batería + generador) desde el
//     panel dedicado, para que estén disponibles en los 3 selectores ---
// Secundaria/Auxiliar solo aparecen fuera de Residencial básico.
await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Comercial / Industrial", exact: true }).click();
await page.waitForTimeout(150);

await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.waitForTimeout(200);

// Ya no hay mini-formulario inline acá (usuario, 2026-11-22: lo eliminó
// por duplicado/confuso con el panel "Declarar fuente de energía").
await page.getByPlaceholder("Ej: Red eléctrica local, Generador diesel 10kW").fill("Banco solar 5kWh");
await page.getByRole("button", { name: "Batería", exact: true }).click();
await page.getByRole("button", { name: "+ Crear fuente" }).click();
await page.waitForTimeout(200);
await page
  .locator("label")
  .filter({ hasText: /^Fuente de energía — Principal/ })
  .locator("xpath=following-sibling::select[1]")
  .selectOption({ label: "Banco solar 5kWh (Batería)" });
await page.waitForTimeout(150);

// --- 2. Confirmar las 3 filas de rol están todas visibles en el
//     mismo formulario (roles primero, antes de crear el tablero) ---
assert((await page.locator("label").filter({ hasText: /^Fuente de energía — Principal/ }).count()) === 1, "Fila 'Fuente de energía — Principal' visible en el form");
assert((await page.locator("label").filter({ hasText: /^Fuente de energía — Secundaria/ }).count()) === 1, "Fila 'Fuente de energía — Secundaria' visible en el form");
assert((await page.locator("label").filter({ hasText: /^Fuente de energía — Auxiliar/ }).count()) === 1, "Fila 'Fuente de energía — Auxiliar' visible en el form");

// --- 3. Sugerencia automática: al elegir Batería como principal, la
//     secundaria debería auto-sugerirse como "Red eléctrica local" ---
const selectSecundaria = page.locator("label").filter({ hasText: /^Fuente de energía — Secundaria/ }).locator("xpath=following-sibling::select[1]");
const valorSecundaria = await selectSecundaria.inputValue();
assert(valorSecundaria === "acometida", `Al elegir Batería como principal, la secundaria se auto-sugiere 'Red eléctrica local' (valor real: ${valorSecundaria})`);

// --- 4. Capacidad (kW) junto a Tensión ---
assert((await page.locator("label").filter({ hasText: /^Capacidad contratada/ }).count()) === 1, "Campo 'Capacidad contratada (kW)' presente");

// --- 5. Notas después de distancia ---
const labels = await page.locator("label").allTextContents();
const idxDistancia = labels.findIndex((l) => l.startsWith("Distancia de la fuente de energía"));
const idxNotas = labels.findIndex((l) => l === "Notas (opcional)");
assert(idxDistancia >= 0 && idxNotas === idxDistancia + 2, `'Notas (opcional)' aparece justo después de la fila Distancia/Material (idx distancia=${idxDistancia}, idx notas=${idxNotas}, labels entre medio: ${JSON.stringify(labels.slice(idxDistancia, idxNotas + 1))})`);

await page.locator("textarea").fill("Banco de baterías en el cuarto eléctrico, generador afuera.");
await page.getByPlaceholder("Ej: 5.75 (básica REBT), 9.2 (elevada REBT)").fill("5.75");

await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("TD-Roles");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(300);

// --- 6. Verificar persistencia: el tablero ya queda expandido
//     automáticamente al crearlo (no hace falta clickear nada) ---
assert((await page.getByText(/Banco solar 5kWh.*principal/).count()) >= 1, "Resumen de fuentes muestra la principal correctamente");
assert((await page.getByText(/Red eléctrica local.*secundaria/).count()) >= 1, "Resumen de fuentes muestra la secundaria sugerida");

await page.locator('button[aria-label^="Editar tablero"]').click();
await page.waitForTimeout(200);
assert((await page.locator("textarea").inputValue()) === "Banco de baterías en el cuarto eléctrico, generador afuera.", "Las notas persisten al reabrir edición");
assert((await page.getByPlaceholder("Ej: 5.75 (básica REBT), 9.2 (elevada REBT)").inputValue()) === "5.75", "La capacidad (kW) persiste al reabrir edición");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/fuente_roles.png", fullPage: true });
await browser.close();
