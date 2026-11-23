// Cálculo automático de iluminación general por área (NEC/CIEN Tabla
// 220.12) — usuario, 2026-11-23: preguntó para qué sirve realmente el
// área construida (m²) de un plano. NEC exige una carga de alumbrado
// general OBLIGATORIA de 33 VA/m² (3 VA/pie²), independiente de cuántos
// focos haya instalados — es el primer renglón de cualquier memoria NEC
// residencial. Este panel (CalcularIluminacionGeneral.jsx) la calcula y
// crea el circuito+equipo solo, con tipoEquipoNEC ILUMINACION_GENERAL
// (que ya dispara la demanda escalonada real de Art. 220.42 — no es un
// cálculo aparte, ver nec.ts). Oculto para REBT (IEC_ES): ahí el área
// es solo un criterio más para elegir el grado de electrificación a
// mano, no alimenta una fórmula de VA directa.
import { chromium } from "playwright";

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1300 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4343"), { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);

// --- 1. Normativa por defecto es NEC: el panel existe y arranca cerrado ---
const encabezadoPanel = page.getByRole("button", { name: /Calcular iluminación general/ });
assert((await encabezadoPanel.count()) === 1, "El panel 'Calcular iluminación general' existe con NEC activo");
assert((await page.getByPlaceholder("Ej: 109.50").count()) === 0, "El panel arranca colapsado (sin el input de área visible)");

await encabezadoPanel.click();
await page.waitForTimeout(150);
assert((await page.getByPlaceholder("Ej: 109.50").isVisible()), "Al abrir el panel aparece el input de área construida");

// --- 2. Cálculo en vivo: 109.50 m² × 33 VA/m² = 3613.5 -> 3614 VA ---
await page.getByPlaceholder("Ej: 109.50").fill("109.50");
await page.waitForTimeout(100);
assert(
  (await page.getByText(/= 3614 VA \(109.5 m² × 33 VA\/m²\)/).count()) >= 1,
  "El cálculo en vivo muestra 3614 VA (109.5 m² × 33 VA/m²), redondeado"
);

// --- 3. Crear el circuito ---
await page.getByRole("button", { name: "+ Crear circuito de iluminación", exact: true }).click();
await page.waitForTimeout(300);
assert(
  (await page.getByText(/Circuito "Iluminación general" creado — 3614 VA/).count()) >= 1,
  "Avisa que se creó el circuito con la carga ya calculada"
);
assert((await page.getByText("Iluminación general").count()) >= 1, "El circuito 'Iluminación general' aparece en la lista");
assert((await page.getByPlaceholder("Ej: 109.50").inputValue()) === "", "El campo de área se limpia después de crear el circuito");

// --- 4. Asignarlo a un tablero y confirmar que la demanda ESCALONADA
//     de NEC 220.42 se aplica de verdad (no el 100% plano): sobre
//     3614 VA, el Art. 220.42 da 3000 + (3614-3000)*0.35 = 3215 W ---
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("TD-ILU");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(250);

await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
await page.getByLabel("Tablero de Iluminación general").selectOption({ label: "TD-ILU" });
await page.waitForTimeout(250);

const etiquetaDemanda = page.locator("div", { hasText: /^Demanda$/ }).first();
const valorDemanda = await etiquetaDemanda.locator("xpath=following-sibling::div[1]").textContent();
assert(/^3215 W$/.test(valorDemanda.trim()), `La demanda aplica el escalonado NEC 220.42 (100% hasta 3kVA + 35% del resto) = 3215 W (real: ${valorDemanda})`);

// --- 5. Con REBT (IEC_ES) el panel no existe — el área no alimenta
//     una fórmula de VA directa en esa normativa ---
await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(250);
await page.getByRole("button", { name: "NEC ▾" }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "IEC", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Validar", exact: true }).click();
await page.waitForTimeout(150);
// Hay circuitos creados: aparece el banner de confirmación.
const botonContinuar = page.getByRole("button", { name: "Continuar y recalcular", exact: true });
if (await botonContinuar.count()) {
  await botonContinuar.click();
  await page.waitForTimeout(250);
}

await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
assert(
  (await page.getByRole("button", { name: /Calcular iluminación general/ }).count()) === 0,
  "Con REBT (IEC_ES) el panel de iluminación general por área no existe (REBT no define VA/m²)"
);

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await browser.close();
