// Promover "Detectar ambientes automáticamente" — usuario, 2026-11-26,
// "Continuemos con detectar ambientes automáticamente". El botón ya
// funcionaba (ver test_deteccion_ambientes_plano_ui.mjs); lo que faltaba
// era que el usuario SUPIERA que hace falta usarlo. Esta prueba verifica
// SOLO la promoción agregada (badge "💡 N sin registrar", título dinámico,
// estilo resaltado del botón, pista del estado vacío) — sin tocar ni
// repetir la lógica de detección en sí, que ya tiene su propia prueba.
// Importante: el NOMBRE ACCESIBLE del botón ("Detectar ambientes
// automáticamente") se mantiene intacto a propósito — ver el commit de
// esta prueba — por eso el selector del botón sigue siendo exacto.
import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto(process.env.BASE_URL || "http://localhost:4343", { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

async function puntoPantallaDesdeImagen(puntoImagen) {
  const svg = page.locator("svg").last();
  const box = await svg.boundingBox();
  const transformAttr = await page.locator("svg > g").last().getAttribute("transform");
  const m = transformAttr.match(/translate\(([-\d.]+),([-\d.]+)\) scale\(([-\d.]+)\)/);
  const panX = parseFloat(m[1]), panY = parseFloat(m[2]), zoom = parseFloat(m[3]);
  return { x: box.x + puntoImagen.x * zoom + panX, y: box.y + puntoImagen.y * zoom + panY };
}

await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);

await page.locator('input[type="file"][accept="image/*,application/pdf"]').setInputFiles(DIR + "fixtures/plano_test.png");
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Calibrar", exact: true }).click();
await page.waitForTimeout(150);
let p = await puntoPantallaDesdeImagen({ x: 100, y: 100 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(100);
p = await puntoPantallaDesdeImagen({ x: 500, y: 100 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(150);
await page.getByPlaceholder("Ej: 5").fill("5");
await page.getByRole("button", { name: "Calibrar", exact: true }).last().click();
await page.waitForTimeout(200);

const panelPlano = page.getByText("Plano inteligente", { exact: true }).locator("xpath=../../..");
const botonDetectar = page.getByRole("button", { name: "Detectar ambientes automáticamente", exact: true });

// --- 0. Sin ninguna pared trazada: el botón "Detectar..." ni siquiera
//     está (requiere nodosPlano.length > 0), así que no hay nada que
//     verificar todavía. ---
assert((await botonDetectar.count()) === 0, "Sin paredes trazadas, el botón de detección ni aparece (correcto, nada que detectar)");

// --- 1. Trazar DOS polilíneas abiertas (ninguna vuelve a su propio
//     punto de inicio) que juntas cierran un rectángulo A-B-C-D, sin
//     que NINGUNA de las 2 se auto-registre como ambiente (mecanismo de
//     cierre-sobre-sí-mismo, ya existente, sin tocar). ---
await page.getByRole("button", { name: "Trazar pared", exact: true }).click();
await page.waitForTimeout(150);
const asistenciaBordes = page.getByLabel("Asistencia de bordes (pega el click al filo más cercano)");
if (await asistenciaBordes.isChecked()) await asistenciaBordes.uncheck();

const A = { x: 100, y: 100 }, B = { x: 500, y: 100 }, C = { x: 500, y: 400 }, D = { x: 100, y: 400 };
for (const punto of [A, B, C]) {
  const pp = await puntoPantallaDesdeImagen(punto);
  await page.mouse.click(pp.x, pp.y);
  await page.waitForTimeout(150);
}
await page.getByRole("button", { name: "Trazar pared", exact: true }).click(); // corta el trazo actual sin cerrarlo
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Trazar pared", exact: true }).click();
await page.waitForTimeout(150);
for (const punto of [C, D, A]) {
  const pp = await puntoPantallaDesdeImagen(punto);
  await page.mouse.click(pp.x, pp.y);
  await page.waitForTimeout(150);
}
await page.waitForTimeout(200);

assert((await panelPlano.getByText("Ambientes (0)").count()) === 1, "Ninguna de las 2 polilíneas se cerró sobre sí misma -> siguen siendo 0 ambientes registrados");

// --- 2. El badge "💡 1 sin registrar" aparece, el botón queda resaltado
//     (estilo + título dinámico), y la pista de la lista vacía ahora
//     menciona el ambiente ya formado. ---
assert((await panelPlano.getByText("· 💡 1 sin registrar").count()) === 1, "Aparece el badge '💡 1 sin registrar' junto al encabezado Ambientes");
const tituloConPendiente = await botonDetectar.getAttribute("title");
assert(/1 ambiente\(s\) cerrado\(s\)/.test(tituloConPendiente), `El título del botón menciona el ambiente pendiente (real: "${tituloConPendiente}")`);
const colorFondoConPendiente = await botonDetectar.evaluate((el) => getComputedStyle(el).backgroundColor);
assert(await panelPlano.getByText(/Ya hay 1 ambiente cerrado formado por las paredes trazadas/).count() === 1, "La pista del estado vacío menciona el ambiente ya formado por las paredes, sin tener que re-trazar");

// --- 3. Al detectarlo, el badge desaparece, el botón vuelve al estilo
//     neutro/atenuado (color de fondo distinto al de antes) y su título
//     vuelve al genérico. ---
await botonDetectar.click();
await page.waitForTimeout(300);
assert((await panelPlano.getByText("Ambientes (1)").count()) === 1, "El ambiente pendiente quedó registrado");
assert((await panelPlano.getByText(/sin registrar/).count()) === 0, "El badge '... sin registrar' ya no aparece — no queda nada pendiente");
const tituloSinPendiente = await botonDetectar.getAttribute("title");
assert(!/ambiente\(s\) cerrado\(s\)/.test(tituloSinPendiente), `El título del botón vuelve al genérico, sin mencionar un ambiente pendiente (real: "${tituloSinPendiente}")`);
const colorFondoSinPendiente = await botonDetectar.evaluate((el) => getComputedStyle(el).backgroundColor);
assert(colorFondoConPendiente !== colorFondoSinPendiente, `El fondo del botón cambia entre "hay pendientes" (${colorFondoConPendiente}) y "no hay pendientes" (${colorFondoSinPendiente}) — la promoción visual es real, no solo el texto`);

// --- 4. El NOMBRE ACCESIBLE del botón sigue siendo exactamente el
//     mismo durante TODO el flujo (antes y después de detectar) — el
//     punto central de esta prueba: la promoción no debía tocar esto. ---
assert((await botonDetectar.count()) === 1, 'El botón sigue siendo ubicable por su nombre accesible exacto "Detectar ambientes automáticamente" después de usarlo');

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await browser.close();
