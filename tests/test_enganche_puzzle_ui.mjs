// Enganche automático de "Mover ambiente" (plano rompecabezas) — UI en
// vivo. Usuario, 2026-11-25: deuda técnica dejada a propósito al
// construir "plano sin imagen" v1 ("Sin enganche automático primero"),
// ahora se salda — ver modules/plano/enganchePuzzle.ts para la
// mecánica pura (probada aparte en test_enganche_puzzle.mjs).
//
// Truco de lectura: los círculos de nodo (<circle> dentro de "svg > g")
// guardan cx/cy en espacio IMAGEN directo (sin la transformación de
// pan/zoom) — no hace falta convertir para COMPARAR posiciones, solo
// para decirle al mouse dónde hacer click/arrastrar en pantalla.
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

async function puntoPantallaDesdeImagen(puntoImagen) {
  const svg = page.locator("svg").last();
  const box = await svg.boundingBox();
  const transformAttr = await page.locator("svg > g").last().getAttribute("transform");
  const m = transformAttr.match(/translate\(([-\d.]+),([-\d.]+)\) scale\(([-\d.]+)\)/);
  const panX = parseFloat(m[1]), panY = parseFloat(m[2]), zoom = parseFloat(m[3]);
  return { x: box.x + puntoImagen.x * zoom + panX, y: box.y + puntoImagen.y * zoom + panY };
}

async function circulos() {
  return page.locator("svg > g circle").evaluateAll((els) => els.map((e) => ({ cx: parseFloat(e.getAttribute("cx")), cy: parseFloat(e.getAttribute("cy")) })));
}

function esquinasCoincidentes(lista, puntoImagen) {
  return lista.filter((c) => Math.abs(c.cx - puntoImagen.x) < 3 && Math.abs(c.cy - puntoImagen.y) < 3).length;
}

async function arrastreChico(centroModeloM, deltaModeloM) {
  const desde = await puntoPantallaDesdeImagen({ x: centroModeloM.x * 120, y: centroModeloM.y * 120 });
  const hasta = await puntoPantallaDesdeImagen({ x: (centroModeloM.x + deltaModeloM.x) * 120, y: (centroModeloM.y + deltaModeloM.y) * 120 });
  await page.mouse.move(desde.x, desde.y);
  await page.mouse.down();
  await page.mouse.move(hasta.x, hasta.y, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(250);
}

await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);

// Marco 10m x 8m (sin imagen) — PX_POR_METRO_RECTIFICADO=120, 1m = 120px de imagen.
await page.getByRole("button", { name: "+ Crear plano sin imagen", exact: true }).click();
await page.waitForTimeout(150);
await page.getByPlaceholder("Ej: 10").fill("10");
await page.getByPlaceholder("Ej: 8").fill("8");
await page.getByRole("button", { name: "+ Crear marco", exact: true }).click();
await page.waitForTimeout(300);

// Habitación A: 4x3 en (2,4) → caja xMin=0,xMax=4,yMin=2.5,yMax=5.5
await page.getByRole("button", { name: "Generar ambiente", exact: true }).click();
await page.waitForTimeout(150);
await page.getByPlaceholder("Nombre (ej. Habitación #1)").fill("A");
await page.getByPlaceholder("Ancho (m)").fill("4");
await page.getByPlaceholder("Largo (m)").fill("3");
let p = await puntoPantallaDesdeImagen({ x: 2 * 120, y: 4 * 120 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);

// Habitación B: 4x3 en (6.1,4) → caja xMin=4.1,xMax=8.1,yMin=2.5,yMax=5.5 — gap de 0.1m contra A (dentro del radio de 0.3m)
await page.getByPlaceholder("Nombre (ej. Habitación #1)").fill("B");
await page.getByPlaceholder("Ancho (m)").fill("4");
await page.getByPlaceholder("Largo (m)").fill("3");
p = await puntoPantallaDesdeImagen({ x: 6.1 * 120, y: 4 * 120 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);

assert((await page.getByText("Ambientes (2)").count()) >= 1, "A y B quedaron creadas (gap de 0.1m entre ellas)");

const puntoTocandoAB = { x: 4 * 120, y: 2.5 * 120 }; // esquina de A — punto de contacto esperado si B engancha
assert(esquinasCoincidentes(await circulos(), puntoTocandoAB) === 1, "Antes de arrastrar, solo la esquina de A está en el punto de contacto");

// --- "Mover ambiente", con enganche automático prendido por defecto ---
await page.getByRole("button", { name: "Mover ambiente", exact: true }).click();
await page.waitForTimeout(150);
assert((await page.getByText("Enganche automático (encaja contra otros ambientes y el borde del plano)").count()) === 1, "Existe el toggle de enganche automático, visible en modo Mover ambiente");

// Arrastre chico (-0.02m en X) — un movimiento real, mucho menor que el gap de 0.1m. Con enganche ON, debe cerrar el resto solo.
await arrastreChico({ x: 6.1, y: 4 }, { x: -0.02, y: 0 });
const enPuntoTrasEngancheOn = esquinasCoincidentes(await circulos(), puntoTocandoAB);
assert(enPuntoTrasEngancheOn === 2, `Con un arrastre chico y enganche ON, B salta a tocar EXACTO el borde de A (real: ${enPuntoTrasEngancheOn} esquinas coincidentes, esperado 2)`);

// --- Apagar el enganche y repetir con un par nuevo (C/D) — NO debe snapear ---
await page.getByText("Enganche automático (encaja contra otros ambientes y el borde del plano)").click();
await page.waitForTimeout(150);

// C: 4x1 en (2.5,6.5) → caja xMin=0.5,xMax=4.5,yMin=6,yMax=7 (lejos de A/B y de los bordes del marco)
await page.getByRole("button", { name: "Generar ambiente", exact: true }).click();
await page.waitForTimeout(150);
await page.getByPlaceholder("Nombre (ej. Habitación #1)").fill("C");
await page.getByPlaceholder("Ancho (m)").fill("4");
await page.getByPlaceholder("Largo (m)").fill("1");
let pC = await puntoPantallaDesdeImagen({ x: 2.5 * 120, y: 6.5 * 120 });
await page.mouse.click(pC.x, pC.y);
await page.waitForTimeout(200);

// D: 4x1 en (6.6,6.5) → caja xMin=4.6,xMax=8.6,yMin=6,yMax=7 — mismo gap de 0.1m que A/B
await page.getByPlaceholder("Nombre (ej. Habitación #1)").fill("D");
await page.getByPlaceholder("Ancho (m)").fill("4");
await page.getByPlaceholder("Largo (m)").fill("1");
let pD = await puntoPantallaDesdeImagen({ x: 6.6 * 120, y: 6.5 * 120 });
await page.mouse.click(pD.x, pD.y);
await page.waitForTimeout(200);

assert((await page.getByText("Ambientes (4)").count()) >= 1, "C y D quedaron creadas (mismo gap de 0.1m que A/B)");

const puntoTocandoCD = { x: 4.5 * 120, y: 6 * 120 };
assert(esquinasCoincidentes(await circulos(), puntoTocandoCD) === 1, "Antes de arrastrar, solo la esquina de C está en ese punto");

await arrastreChico({ x: 6.6, y: 6.5 }, { x: -0.02, y: 0 });
const enPuntoTrasEngancheOff = esquinasCoincidentes(await circulos(), puntoTocandoCD);
assert(enPuntoTrasEngancheOff === 1, `Con enganche OFF, el mismo arrastre chico NO cierra el gap exacto (real: ${enPuntoTrasEngancheOff} esquinas coincidentes, esperado 1 = sin snap)`);

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/enganche_puzzle_ui.png", fullPage: true });
await browser.close();
