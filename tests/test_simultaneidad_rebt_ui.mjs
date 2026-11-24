import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
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

await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);

// --- 0. Bajo NEC (default): el bloque REBT NO debe existir en absoluto ---
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("Edificio bajo NEC");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(200);
assert(
  !(await page.getByText("+ Activar simultaneidad de viviendas").isVisible().catch(() => false)),
  "(NEC) El bloque de simultaneidad REBT no aparece bajo normativa NEC"
);

// --- 1. Cambiar a REBT (IEC España) ---
await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "NEC ▾" }).click();
await page.getByRole("button", { name: "IEC", exact: true }).click();
await page.getByRole("button", { name: "Validar", exact: true }).click();
await page.waitForTimeout(200);
// "Tri" no aparece en Residencial básico (nivel por defecto,
// independiente de la normativa) — subir a un nivel que sí lo ofrezca.
await page.getByRole("button", { name: "Comercial / Industrial", exact: true }).click();
await page.waitForTimeout(150);

await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);
assert(
  await page.getByText("+ Activar simultaneidad de viviendas").isVisible(),
  "(IEC/REBT) El bloque de simultaneidad REBT SÍ aparece"
);

// --- 2. Crear el tablero "edificio" y activar el modo REBT ---
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("Edificio Las Flores");
await page.locator("form").getByRole("button", { name: "Tri", exact: true }).click();
await page.getByPlaceholder("Desde la fuente de energía").fill("20");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(200);

await page.getByRole("button", { name: "+ Activar simultaneidad de viviendas (edificio REBT)" }).click();
await page.getByRole("button", { name: "Guardar", exact: true }).first().click();
await page.waitForTimeout(200);
assert(await page.getByText(/Edificio de viviendas — grado por defecto/).isVisible(), "El modo REBT queda activo y se muestra en la tarjeta");

// --- 3. Crear 2 viviendas (subtableros) colgando del edificio, sin circuitos ---
// La tarjeta ya queda expandida tras crear/activar REBT -- NO volver a
// clickear el header (toggle: lo cerraría).
await page.getByRole("button", { name: "+ Subtablero" }).first().click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("Depto 1");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(200);
// Crear el subtablero deja AL HIJO activo/expandido, no al padre -- hay
// que reabrir el padre (estaba colapsado, un solo click lo expande).
await page.getByText("Edificio Las Flores", { exact: true }).first().click();
await page.waitForTimeout(150);

await page.getByRole("button", { name: "+ Subtablero" }).first().click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("Depto 2");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(200);
await page.getByText("Edificio Las Flores", { exact: true }).first().click();
await page.waitForTimeout(200);

// --- 4. El alimentador del edificio debe calcular OK con la carga simultánea (2 viviendas básica = coef 2, media 5750 -> 11500W = 11.50kW) ---
assert(
  await page.getByText(/2 viviendas · coeficiente 2 · carga 11\.50kW/).isVisible(),
  "El resumen REBT en la tarjeta del edificio muestra n=2, coeficiente=2, carga=11.50kW (2 viviendas básica sin circuitos)"
);

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await page.screenshot({ path: DIR + "tmp/rebt_resultado.png", fullPage: true });
await browser.close();
