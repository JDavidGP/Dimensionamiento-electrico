// "Detectar ambientes automáticamente" — deuda técnica del README
// ("Detección de habitaciones limitada a lazos que cierran sobre su
// propio punto de inicio", usuario, 2026-11-25). Verifica en vivo que
// trazar un rectángulo + UNA pared interior que lo divide en 2 ya
// alcanza para que AMBOS sub-ambientes se detecten solos, sin volver
// a trazar cada uno por separado desde cero.
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

// --- 0. Imagen real de prueba + calibración (400px = 5m, mismo
//     patrón ya probado por el resto de las pruebas de Plano) — evita
//     el marco sintético de "Plano sin imagen" (bastante más grande
//     que el contenedor, dispara un reajuste de zoom a mitad de un
//     trazo largo de varios puntos, nada que ver con esta prueba). ---
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

// --- 1. Trazar el PERÍMETRO completo (hexágono: D-A-M-B-C-N-D, con M
//     y N en el medio de los lados superior/inferior de un rectángulo
//     de 7.5×5m) — cierra solo al volver a D, registrando 1 ambiente
//     de 37.5 m² (mecanismo YA existente, sin cambios). ---
await page.getByRole("button", { name: "Trazar pared", exact: true }).click();
await page.waitForTimeout(150);
// "Asistencia de bordes" buscaría bordes reales en la imagen de
// prueba (que sí tiene paredes dibujadas) y podría "pegar" algún
// click a un borde real distinto del punto exacto pedido — se
// desactiva para que esta prueba geométrica sea 100% predecible.
const asistenciaBordes = page.getByLabel("Asistencia de bordes (pega el click al filo más cercano)");
if (await asistenciaBordes.isChecked()) await asistenciaBordes.uncheck();
const D = { x: 100, y: 500 }, A = { x: 100, y: 100 }, M = { x: 400, y: 100 }, B = { x: 700, y: 100 }, C = { x: 700, y: 500 }, N = { x: 400, y: 500 };
for (const punto of [D, A, M, B, C, N, D]) {
  const pp = await puntoPantallaDesdeImagen(punto);
  await page.mouse.click(pp.x, pp.y);
  await page.waitForTimeout(150);
}
assert((await panelPlano.getByText("Ambientes (1)").count()) === 1, "El perímetro completo se cerró solo como 1 ambiente de 37.5 m² (mecanismo ya existente, sin tocar)");

// --- 2. Trazar SOLO la pared interior M-N (2 clicks, no cierra nada
//     por sí misma — es justo el caso que el README señalaba como no
//     soportado: "un ambiente con una forma más compleja... no se
//     detecta solo"). ---
p = await puntoPantallaDesdeImagen(M);
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(120);
p = await puntoPantallaDesdeImagen(N);
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);
assert((await panelPlano.getByText("Ambientes (1)").count()) === 1, "La pared interior sola todavía NO agrega ningún ambiente (sigue habiendo 1)");

// --- 3. "Detectar ambientes automáticamente" encuentra los 2
//     sub-ambientes (18.75 m² cada uno) SIN haber trazado cada uno por
//     separado volviendo a su propio punto de partida. ---
await page.getByRole("button", { name: "Detectar ambientes automáticamente", exact: true }).click();
await page.waitForTimeout(300);
assert((await page.getByText(/2 ambientes nuevos detectados/).count()) >= 1, "Avisa que detectó 2 ambientes nuevos");
assert((await panelPlano.getByText("Ambientes (3)").count()) === 1, "Ahora hay 3 ambientes: el hexágono original + los 2 sub-ambientes nuevos");

// hasText matchea cualquier div cuyo texto COMPLETO (de toda su
// descendencia) contenga el patrón, así que una tarjeta entera (con
// el nombre, el badge, etc.) también matchea, duplicado, además del
// div puntual "X.XX m² · perímetro Y m" — se extrae con un regex
// ANCLADO al inicio de cada texto en vez de parseFloat crudo, que
// fallaba (NaN) contra el texto más largo de las tarjetas completas.
const areasTexto = await panelPlano.locator("div").filter({ hasText: /m² · perímetro/ }).allTextContents();
const areasNum = areasTexto
  .map((t) => t.match(/^(\d+(?:\.\d+)?) m² · perímetro/))
  .filter(Boolean)
  .map((m) => parseFloat(m[1]))
  .sort((a, b) => a - b);
assert(areasNum.length === 3, `Se leyeron exactamente 3 valores de área, uno por ambiente (real: ${JSON.stringify(areasNum)})`);
// Tolerancia de 0.3 m² — ruido de redondeo de click-a-píxel (mismo
// criterio que el resto de las pruebas de Plano con clicks reales).
assert(Math.abs(areasNum[0] - 18.75) < 0.3 && Math.abs(areasNum[1] - 18.75) < 0.3, `Los 2 sub-ambientes miden ≈18.75 m² cada uno (3.75×5) (real: ${JSON.stringify(areasNum)})`);
assert(Math.abs(areasNum[2] - 37.5) < 0.3, `El ambiente original (hexágono) sigue midiendo ≈37.5 m² (real: ${areasNum[2]})`);

// --- 4. Deshacer revierte LOS 2 sub-ambientes de una sola vez (un solo paso de deshacer para todo el lote). ---
await page.getByRole("button", { name: "↶ Deshacer", exact: true }).click();
await page.waitForTimeout(200);
assert((await panelPlano.getByText("Ambientes (1)").count()) === 1, "Deshacer revierte el LOTE completo de detección en un solo paso (vuelve a 1 ambiente)");

// --- 5. Re-detectar y, al correrlo una 2da vez sin cambios, no duplica nada. ---
await page.getByRole("button", { name: "Detectar ambientes automáticamente", exact: true }).click();
await page.waitForTimeout(300);
assert((await panelPlano.getByText("Ambientes (3)").count()) === 1, "Vuelve a detectar los mismos 2 ambientes");
await page.getByRole("button", { name: "Detectar ambientes automáticamente", exact: true }).click();
await page.waitForTimeout(300);
assert((await page.getByText(/No se encontró ningún ambiente nuevo/).count()) >= 1, "Correr la detección de nuevo no duplica nada — avisa que no hay ambientes nuevos");
assert((await panelPlano.getByText("Ambientes (3)").count()) === 1, "Sigue habiendo exactamente 3 ambientes, ninguno duplicado");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/deteccion_ambientes_plano.png", fullPage: true });
await browser.close();
