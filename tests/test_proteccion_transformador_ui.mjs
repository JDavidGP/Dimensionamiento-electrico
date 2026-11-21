// Protección de sobrecorriente del transformador en la UI (usuario,
// 2026-11-21, "resolvamos transformadores" — subió la Tabla 450.3(B)
// del NEC con datos duros). Usa el MISMO ejemplo numérico del
// documento (75kVA, 480→208V trifásico) para poder comparar el
// resultado mostrado contra un valor ya conocido de antemano.
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

// --- 0. Comercial/industrial (gate del panel) — normativa NEC ya es la de por defecto ---
await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(250);
await page.getByRole("button", { name: "Comercial / Industrial", exact: true }).click();
await page.waitForTimeout(150);

await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);

// --- 1. Crear transformador SIN capacidad: debe avisar que falta, no mostrar un cálculo inventado ---
await page.getByRole("button", { name: "+ Nuevo transformador" }).click();
await page.getByPlaceholder("Ej: Transformador reductor 480V→240V").fill("TR-450-3B");
await page.getByRole("button", { name: "Tri", exact: true }).first().click();
await page.getByPlaceholder("Ej: 480").fill("480");
await page.getByPlaceholder("Ej: 240").fill("208");
await page.getByRole("button", { name: "+ Crear transformador" }).click();
await page.waitForTimeout(250);

assert(await page.getByText(/pendientes: Falta capacidad/).isVisible(), "Sin capacidad (kVA), avisa que falta el dato — no inventa un cálculo");

// --- 2. Editar: agregar capacidad = 75 kVA (el ejemplo exacto del documento NEC) ---
await page.getByRole("button", { name: "Editar transformador TR-450-3B" }).click();
await page.waitForTimeout(150);
await page.getByPlaceholder("Ej: 75").fill("75");
await page.getByRole("button", { name: "Guardar cambios" }).click();
await page.waitForTimeout(250);

// --- 3. Corriente nominal: primario ≈90.2A, secundario ≈208.2A ---
const textoCorrientes = await page.getByText(/Corriente nominal/).textContent();
assert(/90\.2A/.test(textoCorrientes), `Corriente primaria ≈90.2A (real: '${textoCorrientes}')`);
assert(/208\.2A/.test(textoCorrientes), `Corriente secundaria ≈208.2A (real: '${textoCorrientes}')`);

// --- 4. Esquema por defecto (primario + secundario): 225A primario, 300A secundario (exacto del documento) ---
assert(await page.getByText(/Protección NEC 450\.3\(B\)/).isVisible(), "Aparece el resultado de protección NEC 450.3(B)");
const textoProteccion = await page.getByText(/Protección NEC 450\.3\(B\)/).textContent();
assert(/primario: 225A \(250%\)/.test(textoProteccion), `Primario 225A/250% (real: '${textoProteccion}')`);
assert(/secundario: 300A \(125%\)/.test(textoProteccion), `Secundario 300A/125% (real: '${textoProteccion}')`);

// --- 5. Cambiar a "Solo primario": ahora 125% de 90.2A = 112.75A -> redondea ARRIBA -> 125A ---
await page.getByRole("button", { name: "Solo primario", exact: true }).click();
await page.waitForTimeout(150);
const textoSoloPrimario = await page.getByText(/Protección NEC 450\.3\(B\)/).textContent();
assert(/primario: 125A \(125%\)/.test(textoSoloPrimario), `Solo primario: 125% de 90.2A→112.75A→redondea ARRIBA→125A (real: '${textoSoloPrimario}')`);
assert(!/secundario:/.test(textoSoloPrimario), "Solo primario: no muestra protección secundaria");

await page.screenshot({ path: DIR + "tmp/proteccion_transformador.png", fullPage: true });

// --- 6. Eliminar ---
await page.getByRole("button", { name: "Eliminar transformador TR-450-3B" }).click();
await page.waitForTimeout(150);

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await browser.close();
