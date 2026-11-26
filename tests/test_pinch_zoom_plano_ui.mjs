// Pellizco de 2 dedos (zoom + pan táctil) en el Plano — usuario,
// 2026-11-26, "Continuemos con el mobile táctil". Antes de esto, el
// ÚNICO zoom era la rueda del mouse: en un teléfono no hay rueda, y
// `touchAction: "pan-y"` fuera de los modos de arrastre bloqueaba
// incluso el pinch-zoom NATIVO del navegador sobre el lienzo — no
// había ninguna forma táctil de acercar/alejar salvo los botones +/-.
// Prueba con PointerEvent sintéticos (pointerId propio, pointerType
// "touch") en vez de hardware táctil real — exactamente lo que React
// escucha vía onPointerDown/Move/Up, sin depender de que el entorno
// de CI tenga una pantalla táctil.
import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto(process.env.BASE_URL || "http://localhost:4343", { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);
await page.locator('input[type="file"][accept="image/*,application/pdf"]').setInputFiles(DIR + "fixtures/plano_test.png");
await page.waitForTimeout(400);

const svg = page.locator("svg").last();

async function zoomActual() {
  const t = await page.locator("svg > g").last().getAttribute("transform");
  const m = t.match(/scale\(([-\d.]+)\)/);
  return parseFloat(m[1]);
}

// Despacha un PointerEvent sintético directo sobre el <svg> — mismo
// mecanismo que escuchan onPointerDown/Move/Up, independiente de que
// el navegador/CI tenga hardware táctil real.
async function puntero(tipo, pointerId, clientX, clientY) {
  await svg.dispatchEvent(tipo, { pointerId, pointerType: "touch", clientX, clientY, bubbles: true, isPrimary: pointerId === 1 });
}

const box = await svg.boundingBox();
const centroX = box.x + box.width / 2;
const centroY = box.y + box.height / 2;

// --- 1. Pellizco que SEPARA los 2 dedos -> acerca (zoom IN) ---
const zoomInicial = await zoomActual();
await puntero("pointerdown", 1, centroX - 50, centroY);
await puntero("pointerdown", 2, centroX + 50, centroY);
await page.waitForTimeout(80);
await puntero("pointermove", 1, centroX - 110, centroY);
await puntero("pointermove", 2, centroX + 110, centroY);
await page.waitForTimeout(80);
const zoomTrasSeparar = await zoomActual();
assert(zoomTrasSeparar > zoomInicial, `Separar los 2 dedos acerca (zoom in) — antes ${zoomInicial.toFixed(3)}, después ${zoomTrasSeparar.toFixed(3)}`);

// --- 2. Mismo pellizco, ahora JUNTANDO los dedos -> aleja (zoom OUT), por debajo del punto anterior ---
await puntero("pointermove", 1, centroX - 30, centroY);
await puntero("pointermove", 2, centroX + 30, centroY);
await page.waitForTimeout(80);
const zoomTrasJuntar = await zoomActual();
assert(zoomTrasJuntar < zoomTrasSeparar, `Juntar los 2 dedos aleja (zoom out) — antes ${zoomTrasSeparar.toFixed(3)}, después ${zoomTrasJuntar.toFixed(3)}`);

// --- 3. Soltar ambos dedos y confirmar que el gesto termina limpio (no queda ningún estado de pellizco pegado) ---
await puntero("pointerup", 1, centroX - 30, centroY);
await puntero("pointerup", 2, centroX + 30, centroY);
await page.waitForTimeout(80);
const zoomTrasSoltar = await zoomActual();
assert(Math.abs(zoomTrasSoltar - zoomTrasJuntar) < 1e-6, "Al soltar ambos dedos, el zoom queda fijo donde estaba (no sigue cambiando solo)");

// --- 4. Un 2do dedo que cae DURANTE un arrastre de "Mover vista" con 1 dedo no lo corrompe: cancela el pan de 1 dedo y pasa a pellizco limpio, sin que el zoom salte a un valor absurdo ---
await page.getByRole("button", { name: "Mover vista", exact: true }).click();
await page.waitForTimeout(150);
await puntero("pointerdown", 3, centroX, centroY);
await puntero("pointermove", 3, centroX + 40, centroY); // empieza a mover la vista con 1 dedo
await page.waitForTimeout(80);
await puntero("pointerdown", 4, centroX - 60, centroY); // 2do dedo cae sin soltar el primero
await page.waitForTimeout(80);
const zoomTrasSegundoDedo = await zoomActual();
assert(Number.isFinite(zoomTrasSegundoDedo) && zoomTrasSegundoDedo > 0 && zoomTrasSegundoDedo < 1000, `El zoom sigue siendo un número razonable tras el 2do dedo accidental (real: ${zoomTrasSegundoDedo})`);
await puntero("pointerup", 3, centroX + 40, centroY);
await puntero("pointerup", 4, centroX - 60, centroY);
await page.waitForTimeout(80);

// --- 5. Tras soltar todo, un gesto de 1 dedo NUEVO (mover vista) sigue funcionando normal — el pellizco no dejó el canvas en un estado roto ---
let t = await page.locator("svg > g").last().getAttribute("transform");
let m = t.match(/translate\(([-\d.]+),([-\d.]+)\)/);
const panXAntes = parseFloat(m[1]);
await puntero("pointerdown", 5, centroX, centroY);
await puntero("pointermove", 5, centroX + 70, centroY);
await page.waitForTimeout(80);
await puntero("pointerup", 5, centroX + 70, centroY);
t = await page.locator("svg > g").last().getAttribute("transform");
m = t.match(/translate\(([-\d.]+),([-\d.]+)\)/);
const panXDespues = parseFloat(m[1]);
assert(Math.abs(panXDespues - panXAntes) > 10, `Después del pellizco, un arrastre de 1 dedo en 'Mover vista' sigue paneando normal (panX antes ${panXAntes.toFixed(1)}, después ${panXDespues.toFixed(1)})`);

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await browser.close();
