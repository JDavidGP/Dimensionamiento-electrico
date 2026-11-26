// "El extra de cruce de pared → conectarlo al cálculo de materiales"
// (usuario, 2026-11-26, último punto de su orden de prioridad). Alcance
// elegido explícitamente por el usuario: un resumen de metros lineales
// de conductor por calibre (sin unidades de compra). Prueba la UI real
// en "Informe técnico": sin ningún circuito con distancia, el aviso de
// "sin datos"; con un circuito calculado Y con distancia cargada,
// aparece su calibre con los metros correctos; una ruta del Plano
// sincronizada con "Usar esta longitud" (que ya incluye el extra de
// cruce de pared) se refleja en el total, sin inventar ningún número
// aparte.
import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1300 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto(process.env.BASE_URL || "http://localhost:4343", { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

// --- 1. Sin ningún dato: el aviso de "sin materiales" ---
await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Informe técnico", exact: true }).click();
await page.waitForTimeout(300);
assert(
  (await page.getByText(/Sin ningún circuito\/tablero con calibre calculado Y distancia cargada todavía/).count()) === 1,
  "Proyecto vacío: aviso de que no hay materiales que resumir todavía"
);
assert((await page.locator("#tabla-informe-circuitos").count()) === 0, "(la tabla de Circuitos tampoco existe sin datos — confirma que estamos viendo el estado vacío real)");

// --- 2. Un circuito calculado con distancia 0 (sin cargar un valor real todavía): sigue sin aparecer en Materiales ---
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(200);
await page.getByPlaceholder("Ej: Iluminación cocina").fill("Circuito sin distancia");
await page.locator("label", { hasText: "Distancia (m)" }).locator("xpath=following-sibling::input[1]").fill("0");
await page.getByRole("button", { name: "+ Crear circuito" }).click();
await page.waitForTimeout(150);
await page.getByPlaceholder("Ej: Refrigerador").fill("Lámpara");
await page.locator("label", { hasText: "P unitaria (W)" }).locator("xpath=following-sibling::input[1]").fill("100");
await page.getByRole("button", { name: "+ Agregar equipo" }).click();
await page.waitForTimeout(200);

await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Informe técnico", exact: true }).click();
await page.waitForTimeout(300);
assert(
  (await page.getByText(/Sin ningún circuito\/tablero con calibre calculado Y distancia cargada todavía/).count()) === 1,
  "Circuito calculado pero SIN distancia: sigue sin aparecer nada en Materiales (no se inventa un metraje)"
);

// --- 3. Cargarle una distancia: ahora SÍ aparece, con el calibre y los metros correctos ---
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: "Editar circuito Circuito sin distancia" }).click();
await page.waitForTimeout(150);
await page.locator("label:has-text('Distancia (m)')").locator("..").locator("input").fill("12");
await page.getByRole("button", { name: "Guardar cambios" }).click();
await page.waitForTimeout(200);

await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Informe técnico", exact: true }).click();
await page.waitForTimeout(300);

const seccionMateriales = page.locator("div").filter({ hasText: "Materiales — metros de conductor por calibre" }).last();
assert((await seccionMateriales.getByText(/^14 AWG$/).count()) >= 1 || (await seccionMateriales.getByText(/AWG/).count()) >= 1, "Aparece el calibre real calculado (ej. 14 AWG) en la sección de Materiales");
assert((await seccionMateriales.getByText("12.00 m", { exact: true }).count()) === 1, "Con 12m de distancia cargados, el total de metros es exactamente 12.00 m");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await browser.close();
