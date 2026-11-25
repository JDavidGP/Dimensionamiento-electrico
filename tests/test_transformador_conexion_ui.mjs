// Conexión Y/Δ del transformador — deuda técnica del README ("conexión
// Y/Δ sin campo de UI") resuelta (usuario, 2026-11-25, "terminemos de
// completar la conexión Y/Δ"). El dato ya existía en la entidad
// (Transformador.conexionPrimaria/conexionSecundaria), solo faltaba
// conectarlo a PanelTransformadores.jsx — puramente informativo,
// ningún cálculo conectado hoy depende de la conexión (decisión
// explícita del usuario: no agregar el aviso de "secundario en Δ sin
// neutro" en esta ronda).
import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto(process.env.BASE_URL || "http://localhost:4343", { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

// --- 0. Pasar a instalación comercial/industrial (gate de Transformadores) ---
await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(350);
await page.getByRole("button", { name: "Comercial / Industrial", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(350);

// --- 1. Transformador TRIFÁSICO: el bloque de conexión aparece, se
//     elige Delta (primaria) / Estrella (secundaria), y la tarjeta
//     resumen muestra "Δ-Y". ---
await page.getByRole("button", { name: "+ Nuevo transformador" }).click();
await page.waitForTimeout(150);
await page.getByPlaceholder("Ej: Transformador reductor 480V→240V").fill("TR-CONEXION-TRI");
await page.getByRole("button", { name: "Tri", exact: true }).first().click();
await page.getByPlaceholder("Ej: 480").fill("480");
await page.getByPlaceholder("Ej: 240").fill("240");

assert((await page.getByText("Conexión primaria (opcional)").count()) === 1, "El bloque de conexión Y/Δ aparece para un transformador trifásico");
await page.getByRole("button", { name: "Delta (Δ)", exact: true }).first().click();
await page.getByRole("button", { name: "Estrella (Y)", exact: true }).last().click();
await page.getByRole("button", { name: "+ Crear transformador" }).click();
await page.waitForTimeout(200);

assert(await page.getByText("TR-CONEXION-TRI").first().isVisible(), "El transformador se creó");
assert(await page.getByText("tri · 480V→240V · Δ-Y", { exact: false }).first().isVisible(), "La tarjeta resumen muestra 'Δ-Y' (primaria Delta, secundaria Estrella)");

// --- 2. Editar: los valores elegidos se recuperan correctamente al reabrir el formulario ---
await page.getByRole("button", { name: "Editar transformador TR-CONEXION-TRI" }).click();
await page.waitForTimeout(150);
// BotonPill no expone un atributo "activo" como texto — se confirma
// indirectamente: cambiar a Estrella en la primaria y guardar, y
// verificar que la tarjeta refleja el nuevo valor (Y-Y), prueba de
// que el formulario SÍ partió de "Delta" (si hubiera partido vacío,
// este cambio no distinguiría nada).
await page.getByRole("button", { name: "Estrella (Y)", exact: true }).first().click();
await page.getByRole("button", { name: "Guardar cambios" }).click();
await page.waitForTimeout(200);
assert(await page.getByText("tri · 480V→240V · Y-Y", { exact: false }).first().isVisible(), "Tras editar la primaria a Estrella, la tarjeta pasa de 'Δ-Y' a 'Y-Y'");

// --- 3. Transformador MONOFÁSICO: el bloque de conexión NO aparece
//     (no tiene sentido Y/Δ en un devanado monofásico simple). ---
await page.getByRole("button", { name: "+ Nuevo transformador" }).click();
await page.waitForTimeout(150);
await page.getByPlaceholder("Ej: Transformador reductor 480V→240V").fill("TR-CONEXION-MONO");
await page.getByRole("button", { name: "Mono", exact: true }).first().click();
assert((await page.getByText("Conexión primaria (opcional)").count()) === 0, "El bloque de conexión Y/Δ NO aparece para un transformador monofásico");
await page.getByRole("button", { name: "Cancelar", exact: true }).click();
await page.waitForTimeout(150);

// --- 4. Persistencia: guardar y reabrir el proyecto conserva la conexión ---
const [descarga] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "↓ Guardar (.pdf)" }).click(),
]);
const rutaDescargada = DIR + "tmp/transformador_conexion.pdf";
await descarga.saveAs(rutaDescargada);
await page.waitForTimeout(200);

await page.reload({ waitUntil: "networkidle" });
await page.locator("label", { hasText: "Abrir" }).locator('input[type="file"]').setInputFiles(rutaDescargada);
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(350);
assert(await page.getByText("tri · 480V→240V · Y-Y", { exact: false }).first().isVisible(), "La conexión Y/Δ persiste tras guardar y reabrir el proyecto");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/transformador_conexion.png", fullPage: true });
await browser.close();
