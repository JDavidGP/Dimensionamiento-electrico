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
await page.waitForTimeout(350);

// --- Rediseño (2026-11-20): el cuadro de ARRIBA siempre está visible
// (no hay botón "+ Nueva fuente" que lo abra/cierre) y solo declara
// Nombre/Tipo/Rol. El cuadro de ABAJO es la lista — tocar una fuente
// la expande para configurar sus características (ya no hay botón ✎
// separado: expandir ES editar).

// --- 1. Declarar la primera fuente: Red local, rol Principal ---
// El cuadro de arriba siempre es el primero en el DOM — .first() lo
// desambigua de los pills (Tipo/Rol) que vuelven a aparecer dentro de
// cada tarjeta expandida más abajo.
await page.getByPlaceholder("Ej: Red eléctrica local, Generador diesel 10kW").fill("Red local PANEL-TEST");
await page.getByRole("button", { name: "Red local", exact: true }).first().click();
await page.getByRole("button", { name: "Principal", exact: true }).first().click();
await page.getByRole("button", { name: "+ Crear fuente" }).click();
await page.waitForTimeout(200);

assert(await page.getByText("Red local PANEL-TEST").first().isVisible(), "La fuente creada aparece en la lista");
assert(await page.getByText("Sin representar en el diagrama unifilar").first().isVisible(), "Fuente recién creada (sin nodo) muestra la advertencia (tarjeta auto-expandida)");
assert(await page.getByText("Red local · Principal").isVisible(), "La tarjeta colapsada muestra tipo y rol");

// --- 2. Declarar una segunda fuente con el MISMO rol: debe quitárselo a la primera ---
await page.getByPlaceholder("Ej: Red eléctrica local, Generador diesel 10kW").fill("Generador PANEL-TEST");
await page.getByRole("button", { name: "Generador", exact: true }).first().click();
const avisoReasignacion = page.getByText('Le quitará el rol "Principal" a "Red local PANEL-TEST"');
await page.getByRole("button", { name: "Principal", exact: true }).first().click();
assert(await avisoReasignacion.isVisible(), "Al elegir un rol ya tomado, avisa que se lo quitará a la otra fuente");
await page.getByRole("button", { name: "+ Crear fuente" }).click();
await page.waitForTimeout(200);

assert(await page.getByText("Generador · Principal").isVisible(), "La fuente nueva queda con el rol Principal");
assert((await page.getByText("Red local · Principal").count()) === 0, "La fuente anterior ya NO tiene el rol Principal (rol único por instalación)");
assert(await page.getByText("Red local PANEL-TEST").first().isVisible(), "La fuente anterior sigue existiendo, solo perdió el rol");

// --- 3. Editar características desde el cuadro de abajo ---
// La tarjeta recién creada ya queda expandida (setActivaId en alCrear) —
// no hace falta tocarla (tocarla de nuevo la colapsaría).
await page.getByPlaceholder("Ej: 10").fill("15");
await page.getByPlaceholder("Ej: 15").fill("22");
// El pill usa text-transform:capitalize solo visual — el texto real es
// "aluminio" en minúscula. .first(): TabsViewPager monta TODAS las
// pestañas siempre (ver nota de sesión) — puede haber otro selector de
// material "aluminio" en una pestaña inactiva (ej. FormularioCircuito);
// el de acá (Fuentes de energía, pestaña Tableros) es el primero en el DOM.
await page.getByRole("button", { name: "aluminio", exact: true }).first().click();
await page.locator('input[type="time"]').first().fill("18:00");
await page.locator('input[type="time"]').nth(1).fill("22:00");
await page.getByRole("button", { name: "Guardar cambios" }).click();
await page.waitForTimeout(200);

assert(await page.getByText("Generador · Principal · 15 kW").isVisible(), "La tarjeta colapsada refleja la entrada de energía prevista guardada");

// --- 4. Vincularla desde el diagrama y confirmar que la advertencia desaparece ---
// Diagrama unifilar y Plano viven agrupados bajo "Esquemas" (ver SubTabs.jsx).
await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Diagrama unifilar", exact: true }).click();
await page.waitForTimeout(350);
const selectTipo = page.locator("select").filter({ has: page.locator('option:has-text("Acometida")') });
await selectTipo.selectOption({ label: "Generador" });
const selectVinculo = page.locator("select").filter({ has: page.locator('option:has-text("— Vincular a (opcional) —")') });
assert((await selectVinculo.locator('option:has-text("Generador PANEL-TEST")').count()) === 1, "La fuente editada aparece como candidata para vincular");
await selectVinculo.selectOption({ label: "Generador PANEL-TEST" });
await page.getByRole("button", { name: "+ Agregar", exact: true }).click();
await page.waitForTimeout(200);

await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(350);
// "Red local PANEL-TEST" sigue sin vincular a un nodo — sigue mostrando
// su propia advertencia (1); lo que cambia es que ya no hay 2 (la del
// Generador, ya vinculado, desaparece).
assert(
  (await page.getByText("Sin representar en el diagrama unifilar").count()) === 1,
  "Tras vincularla, la advertencia del Generador desaparece del panel de fuentes (queda solo 1: la de Red local, todavía sin vincular)"
);

// --- 5. Eliminar ambas ---
await page.getByRole("button", { name: "Eliminar fuente Generador PANEL-TEST" }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Eliminar fuente Red local PANEL-TEST" }).click();
await page.waitForTimeout(200);
assert((await page.getByText("Generador PANEL-TEST").count()) === 0, "La primera fuente eliminada ya no aparece en la lista");
assert((await page.getByText("Red local PANEL-TEST").count()) === 0, "La segunda fuente eliminada ya no aparece en la lista");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await page.screenshot({ path: DIR + "tmp/panel_fuentes.png", fullPage: true });
await browser.close();
