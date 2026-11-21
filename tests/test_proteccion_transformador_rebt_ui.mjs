// Protección del transformador bajo IEC_ES (REBT) en la UI — usuario,
// 2026-11-21, "si dimensiona las protecciones del iec_es", documentos
// "protección de transformador" (ITC-BT-48 pto.3: sin % fijo) +
// "tabla de valores normalizados" (serie R10 IEC 60947-2). Usa el
// MISMO ejemplo numérico del primer documento (400kVA, 400V trifásico,
// %Z=4%) para comparar contra un resultado ya conocido (interruptor
// 630A, Icc=14.4kA).
import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
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

// --- 0. Comercial/industrial (gate del panel) + normativa IEC_ES ---
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

// --- 1. Crear transformador SIN capacidad: avisa que falta, no inventa ---
await page.getByRole("button", { name: "+ Nuevo transformador" }).click();
await page.getByPlaceholder("Ej: Transformador reductor 480V→240V").fill("TR-REBT");
await page.getByRole("button", { name: "Tri", exact: true }).first().click();
await page.getByPlaceholder("Ej: 480").fill("400");
await page.getByPlaceholder("Ej: 240").fill("400");
await page.getByRole("button", { name: "+ Crear transformador" }).click();
await page.waitForTimeout(250);

assert(await page.getByText(/pendientes: Falta capacidad/).isVisible(), "Sin capacidad (kVA), avisa que falta el dato — no inventa un cálculo");

// --- 2. Editar: capacidad = 400 kVA (sin %Z todavía) ---
await page.getByRole("button", { name: "Editar transformador TR-REBT" }).click();
await page.waitForTimeout(150);
await page.getByPlaceholder("Ej: 75").fill("400");
await page.getByRole("button", { name: "Guardar cambios" }).click();
await page.waitForTimeout(250);

// --- 3. Corriente nominal secundaria ≈577.4A, interruptor propuesto 630A (siguiente valor normalizado) ---
const textoCorriente = await page.getByText(/Corriente nominal secundario/).textContent();
assert(/577\.4A/.test(textoCorriente), `Corriente nominal secundaria ≈577.4A (real: '${textoCorriente}')`);

const textoInterruptor = await page.getByText(/Interruptor general BT propuesto/).textContent();
assert(/630A/.test(textoInterruptor), `Interruptor propuesto = 630A, siguiente valor normalizado ≥ 577.4A (real: '${textoInterruptor}')`);
assert(!/450\.3/.test(await page.content()), "NO aparece ningún rastro de la tabla NEC 450.3(B) bajo IEC_ES");

// Cortocircuito pendiente, todavía sin %Z
assert(await page.getByText(/Cortocircuito en bornes pendiente/).isVisible(), "Sin %Z de placa, el cortocircuito en bornes queda pendiente (no inventa un %Z típico)");

// --- 4. Agregar %Z = 4 (el ejemplo exacto del documento): Icc ≈14.4kA ---
await page.getByRole("button", { name: "Editar transformador TR-REBT" }).click();
await page.waitForTimeout(150);
await page.getByPlaceholder("Ej: 4", { exact: true }).fill("4");
await page.getByRole("button", { name: "Guardar cambios" }).click();
await page.waitForTimeout(250);

const textoIcc = await page.getByText(/Icc en bornes del transformador/).textContent();
assert(/14\.4 kA/.test(textoIcc), `Icc en bornes ≈14.4kA, exacto contra el documento (real: '${textoIcc}')`);

await page.screenshot({ path: DIR + "tmp/proteccion_transformador_rebt.png", fullPage: true });

// --- 5. Transformador monofásico — usuario, 2026-11-21, documento "transformador monofásico": Icc SIN √3 (fórmula propia, ya cubierta) ---
await page.getByRole("button", { name: "Eliminar transformador TR-REBT" }).click();
await page.waitForTimeout(150);

await page.getByRole("button", { name: "+ Nuevo transformador" }).click();
await page.getByPlaceholder("Ej: Transformador reductor 480V→240V").fill("TR-mono");
await page.getByRole("button", { name: "Mono", exact: true }).first().click();
await page.getByPlaceholder("Ej: 480").fill("240");
await page.getByPlaceholder("Ej: 240").fill("120");
await page.getByPlaceholder("Ej: 75").fill("50");
await page.getByPlaceholder("Ej: 4", { exact: true }).fill("3");
await page.getByRole("button", { name: "+ Crear transformador" }).click();
await page.waitForTimeout(250);

// In secundario = 50000/120 = 416.7A; Z = 0.03×120²/50000 = 0.00864Ω; Icc = 120/0.00864 = 13888.9A ≈ 13.9kA (sin √3, a diferencia del trifásico).
const textoIccMono = await page.getByText(/Icc en bornes del transformador/).textContent();
assert(/13\.9 kA/.test(textoIccMono), `Icc monofásico en bornes ≈13.9kA (fórmula sin √3) (real: '${textoIccMono}')`);

await page.getByRole("button", { name: "Eliminar transformador TR-mono" }).click();
await page.waitForTimeout(150);

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await browser.close();
