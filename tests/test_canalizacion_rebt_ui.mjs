// Diámetro de tubo REBT (ITC-BT-21) + agrupación de tubos enterrados
// (ITC-BT-19 Tabla B) + instalación enterrada (ITC-BT-07) conectados a
// la UI — usuario, 2026-11-25, "empecemos a construir" (canalizaciones
// aéreas y subterráneas). Equivalente REBT de
// test_ccc_enterrado_nec_ui.mjs — ver BloqueCanalizacionREBT en
// PanelTableros.jsx, que solo aparece bajo IEC_ES (NEC/CIEN usan
// BloqueLlenadoConducto, tabla distinta).
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
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("TD-REBT");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(300);

assert((await page.getByText(/Diámetro de tubo \(ITC-BT-21\)/).count()) === 0, "Sin circuitos todavía, el bloque REBT no aparece");

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

// A y B: misma carga → misma sección REBT (1.5mm²). C: carga mucho mayor → sección distinta (6mm², verificado a mano).
await crearCircuitoConEquipo("Circuito A", 1200);
await crearCircuitoConEquipo("Circuito B", 1200);
await crearCircuitoConEquipo("Circuito C", 5000);

const selectsTablero = page.getByRole("combobox", { name: /^Tablero de/ });
const cantidadSelects = await selectsTablero.count();
for (let i = 0; i < cantidadSelects; i++) {
  await selectsTablero.nth(i).selectOption({ label: "TD-REBT" });
}
await page.waitForTimeout(200);

await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);

assert((await page.getByText(/Diámetro de tubo \(ITC-BT-21\)/).count()) >= 1, "El bloque REBT aparece con circuitos asignados y calculados");
assert((await page.getByText(/Llenado de conducto/).count()) === 0, "El bloque NEC (tabla distinta) no aparece bajo REBT");
assert((await page.getByText("Circuito A — 1.5 mm²").count()) === 1, "Lista 'Circuito A' con su sección real en mm² (reusada del cálculo, no reingresada)");
assert((await page.getByText("Circuito C — 6 mm²").count()) === 1, "Lista 'Circuito C' con una sección distinta (carga mucho mayor)");

const checkboxes = page.locator("label", { hasText: /Circuito [ABC]/ }).locator('input[type="checkbox"]');

// A + B: misma sección (1.5mm²) → calcula un diámetro real
await checkboxes.nth(0).check();
await checkboxes.nth(1).check();
await page.waitForTimeout(200);
assert((await page.getByText("Diámetro exterior mínimo: 12 mm (superficial, 2 conductores de 1.5 mm²)").count()) === 1, "2 conductores de 1.5mm² en tubo superficial: 12mm (Tabla 2 de ITC-BT-21)");

// Agregar C (6mm², distinta sección) → secciones mixtas, no se inventa un diámetro
await checkboxes.nth(2).check();
await page.waitForTimeout(200);
assert((await page.getByText(/mezcla secciones distintas \(1.5, 6 mm²\)/).count()) === 1, "Al mezclar 1.5mm² y 6mm², avisa en vez de calcular un diámetro que ITC-BT-21 no tabula");
assert((await page.getByText(/Diámetro exterior mínimo:/).count()) === 0, "Con secciones mixtas, no muestra ningún diámetro (ni el de antes, pegado)");

await checkboxes.nth(2).uncheck();
await page.waitForTimeout(200);

// --- Tabla 7 ("al aire", 1.2.3) — alcance angosto: solo tubo flexible a máquina, no tendido general ---
const selectTipo = page.locator("select").filter({ hasText: "superficial" });
const opcionesTipo = await selectTipo.locator("option").allTextContents();
assert(opcionesTipo.includes("al aire (tubo flexible a máquina)"), `La opción 'al aire' aparece con su etiqueta completa, no el valor crudo (real: ${JSON.stringify(opcionesTipo)})`);
await selectTipo.selectOption("al_aire");
await page.waitForTimeout(150);
assert((await page.getByText("Diámetro exterior mínimo: 12 mm (al aire (tubo flexible a máquina), 2 conductores de 1.5 mm²)").count()) === 1, "Calcula con la Tabla 7 (12mm para 2 conductores de 1.5mm²) y muestra la etiqueta correcta en el resultado");
await selectTipo.selectOption("superficial");
await page.waitForTimeout(150);

// --- Agrupación de tubos enterrados (ITC-BT-19 Tabla B) ---
await page.getByPlaceholder("Cantidad").fill("3");
await page.waitForTimeout(150);
assert((await page.getByText("factor de corrección: 0.71").count()) === 1, "3 tubos en contacto (separación por defecto): factor 0,71 (Tabla B)");

await page.getByRole("combobox").filter({ hasText: "En contacto" }).selectOption("1.00_o_mas");
await page.waitForTimeout(150);
assert((await page.getByText("factor de corrección: 1.00").count()) === 1, "3 tubos a ≥1m de separación: sin corrección (1,00)");

// --- Instalación enterrada (ITC-BT-07) — también cambia la tabla de diámetro (Tabla 9, no Tabla 2/5) ---
const panelRebt = page.locator("div", { hasText: "Diámetro de tubo (ITC-BT-21)" }).filter({ has: page.getByText(/Tubos enterrados agrupados/) }).last();
assert((await panelRebt.getByText("Tipo de instalación:").count()) === 1, "Antes de marcar enterrado, el selector superficial/empotrada está visible (Tabla 2/5)");
assert((await page.getByText("¿Este tubo va enterrado? (ITC-BT-07)").count()) === 1, "Existe el toggle de instalación enterrada REBT, en el mismo bloque");
await page.getByText("¿Este tubo va enterrado? (ITC-BT-07)").click();
await page.waitForTimeout(150);
assert((await panelRebt.getByText("Tipo de instalación:").count()) === 0, "Al marcar enterrado, el selector superficial/empotrada desaparece (ya no aplica, rige la Tabla 9)");
assert((await page.getByText("Diámetro exterior mínimo: 25 mm (enterrado, Tabla 9, 2 conductores de 1.5 mm²)").count()) === 1, "Al marcar enterrado, el diámetro cambia a la Tabla 9 (25mm), no sigue en la Tabla 2 (12mm)");
assert((await page.getByText("Profundidad mínima exigida: 0.60 m").count()) === 1, "Por defecto (acera): exige 0,60m — ITC-BT-07");

await page.getByPlaceholder("Profundidad real (m)").fill("0.4");
await page.waitForTimeout(150);
assert((await page.getByText("⚠ No alcanza la profundidad mínima.").count()) === 1, "0,40m medidos no alcanzan el mínimo de 0,60m bajo acera");

await page.getByPlaceholder("Profundidad real (m)").fill("0.7");
await page.waitForTimeout(150);
assert((await page.getByText("✓ Cumple.").count()) === 1, "0,70m medidos sí cumplen el mínimo de 0,60m bajo acera");

await page.locator("select").filter({ hasText: "Bajo acera" }).selectOption("calzada");
await page.waitForTimeout(150);
assert((await page.getByText("Profundidad mínima exigida: 0.80 m").count()) === 1, "Bajo calzada exige más profundidad (0,80m) que bajo acera");

assert((await page.getByText(/Protección mecánica/).count()) >= 1, "Recuerda la protección mecánica a 0,25m sobre el cable directamente enterrado");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/canalizacion_rebt_ui.png", fullPage: true });
await browser.close();
