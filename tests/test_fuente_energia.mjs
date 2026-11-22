import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4347"), { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

// --- 1. Residencial básico es el default: confirmar que "Tri" NO aparece
//     ni en circuitos ni en el alimentador del tablero ---
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.waitForTimeout(200);

const fasesAlimentador = page.locator("label", { hasText: "Fases del alimentador" }).locator("xpath=following-sibling::div[1]");
assert((await fasesAlimentador.getByRole("button", { name: "Tri", exact: true }).count()) === 0, "Residencial básico: 'Tri' NO aparece en Fases del alimentador del tablero (bug reportado)");
assert((await fasesAlimentador.getByRole("button", { name: "Mono", exact: true }).count()) === 1, "Pero 'Mono' sí aparece");

// --- 2. El selector de origen ahora se llama "Fuente de energía" y el
//     default dice "Red eléctrica local" ---
const labelFuente = page.locator("label").filter({ hasText: /^Fuente de energía/ });
assert((await labelFuente.count()) === 1, "El campo se llama 'Fuente de energía' (ya no 'Origen')");
assert((await page.getByText("Red eléctrica local (acometida / poste)").count()) >= 1, "La opción default del selector dice 'Red eléctrica local (acometida / poste)'");

// --- 3. Transformador NO debe aparecer como opción en residencial básico ---
assert((await page.getByText("+ Nuevo transformador").count()) === 0, "Transformador no se ofrece en residencial básico");

// --- 4. Crear una fuente de energía (batería) desde el panel "Declarar
//     fuente de energía" (ya no hay mini-formulario inline acá — usuario,
//     2026-11-22, lo eliminó por duplicado/confuso con ese panel),
//     elegirla como fuente principal, confirmar label "Distancia de la
//     fuente de energía" y "Material del conductor" ---
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

assert((await page.locator("label").filter({ hasText: "Distancia de la fuente de energía" }).count()) === 1, "El campo de distancia dice 'Distancia de la fuente de energía (m)'");
assert((await page.locator("label").filter({ hasText: "Material del conductor" }).count()) >= 1, "El campo de material dice 'Material del conductor' (aparece también en el form de circuito)");

await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("TD-Hibrido");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(300);

// --- 5. Expandir el tablero: "Alimenta desde" refleja la fuente creada,
//     y el bloque de fuentes secundaria/auxiliar muestra la principal
//     derivada (de solo lectura) sin pedirla de nuevo ---
await page.getByText("▸").click();
await page.waitForTimeout(200);
assert((await page.getByText(/Banco solar 5kWh/).count()) >= 1, "'Alimenta desde' muestra la fuente de energía creada");

await page.getByText("+ Agregar fuente secundaria / auxiliar").click();
await page.waitForTimeout(150);
assert((await page.getByText("Fuente principal:").count()) === 1, "El bloque de fuentes muestra 'Fuente principal' de solo lectura");
assert((await page.locator("div").filter({ hasText: /^Banco solar 5kWh/ }).count()) >= 1, "La fuente principal mostrada coincide con la elegida arriba (sin selector duplicado)");

// Elegir una fuente secundaria: red eléctrica local
const selectSecundaria = page.locator("select").filter({ has: page.locator('option:has-text("Red eléctrica local")') }).first();
await selectSecundaria.selectOption({ label: "Red eléctrica local" });
await page.getByRole("button", { name: "Guardar", exact: true }).click().catch(() => {});
await page.waitForTimeout(150);
assert((await page.getByText(/principal\)/).count()) >= 1, "Tras guardar, el resumen de fuentes muestra '(principal)' correctamente derivado");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/fuente_energia.png", fullPage: true });
await browser.close();
