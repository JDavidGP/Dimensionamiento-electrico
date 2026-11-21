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

await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);

// --- El panel de abajo ahora dice "Editar fuentes de energía" ---
assert((await page.getByText("Editar fuentes de energía").count()) === 1, "El panel inferior se llama 'Editar fuentes de energía'");

// --- Crear una fuente desde el panel dedicado: YA NO debe pedir rol ---
await page.getByRole("button", { name: "+ Nueva fuente" }).click();
await page.waitForTimeout(150);
assert((await page.getByText("Rol", { exact: true }).count()) === 0, "El formulario de 'Editar fuentes de energía' ya NO pide Rol");
await page.getByPlaceholder("Ej: Banco de baterías solar, Generador diesel 10kW").fill("Generador diesel 10kW");
await page.locator("button", { hasText: "Generador" }).click();
await page.getByPlaceholder("Ej: 10").fill("10");
await page.getByRole("button", { name: "+ Crear fuente" }).click();
await page.waitForTimeout(200);

// --- La tarjeta ya no muestra "(rol)" ---
assert((await page.getByText("Generador · 10 kW").count()) === 1, "La tarjeta muestra tipo + capacidad, sin rol");

// --- El mini-formulario inline del tablero tampoco pide rol ---
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.waitForTimeout(200);
await page.getByText("+ Nueva fuente de energía (Batería/Generador)").click();
await page.waitForTimeout(150);
assert((await page.getByText("Rol de esta fuente:", { exact: true }).count()) === 0, "El mini-formulario inline del tablero ya NO pide rol");

// --- El selector Principal muestra la fuente sin "(rol)" ---
const selectPrincipal = page.locator("label").filter({ hasText: /^Fuente de energía — Principal/ }).locator("xpath=following-sibling::select[1]");
const opcionGenerador = await selectPrincipal.locator('option:has-text("Generador diesel 10kW")').textContent();
assert(opcionGenerador.trim() === "Generador diesel 10kW (Generador)", `La opción del selector dice '(Generador)' sin rol (texto real: '${opcionGenerador.trim()}')`);

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/sin_rol.png", fullPage: true });
await browser.close();
