// Snap de ángulo al trazar pared — usuario, 2026-11-25/26, "¿cómo
// tener trazos más limpios?". Prueba la UI real: un trazo con un
// ligero desvío (unos pocos grados) respecto a la horizontal sale
// perfectamente horizontal con el snap prendido, y queda con el
// desvío real si se apaga el toggle. También confirma que "pegar a un
// nodo existente" (ya construido antes) sigue funcionando igual, sin
// que el snap de ángulo lo pise.
import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1300 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto(process.env.BASE_URL || "http://localhost:4343", { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);
await page.locator('input[type="file"][accept="image/*,application/pdf"]').setInputFiles(DIR + "fixtures/plano_test.png");
await page.waitForTimeout(400);

const panelPlano = page.locator('div[style*="grid-template-columns: 1fr 280px"]').first();
const svgPlano = panelPlano.locator("svg").last();
const REGEX_PAN_ZOOM = /translate\(([-\d.]+),([-\d.]+)\) scale\(([-\d.]+)\)/;
async function grupoPanZoomPlano() {
  const grupos = await panelPlano.locator("svg > g").all();
  for (const g of grupos) {
    const t = await g.getAttribute("transform");
    if (t && REGEX_PAN_ZOOM.test(t)) return g;
  }
  throw new Error("No se encontró el grupo de pan/zoom del Plano.");
}
async function puntoPantallaDesdeImagen(puntoImagen) {
  const grupo = await grupoPanZoomPlano();
  const box = await svgPlano.boundingBox();
  const t = await grupo.getAttribute("transform");
  const m = t.match(REGEX_PAN_ZOOM);
  const panX = parseFloat(m[1]), panY = parseFloat(m[2]), zoom = parseFloat(m[3]);
  return { x: box.x + puntoImagen.x * zoom + panX, y: box.y + puntoImagen.y * zoom + panY };
}
async function click(puntoImagen) {
  const p = await puntoPantallaDesdeImagen(puntoImagen);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(100);
}
async function circulos() {
  return panelPlano.locator("svg > g circle").evaluateAll((els) => els.map((e) => ({ cx: parseFloat(e.getAttribute("cx")), cy: parseFloat(e.getAttribute("cy")) })));
}
function circuloCercaDe(lista, punto, tolerancia = 2) {
  return lista.find((c) => Math.abs(c.cx - punto.x) < tolerancia && Math.abs(c.cy - punto.y) < tolerancia);
}

await panelPlano.getByRole("button", { name: "Calibrar por perímetro", exact: true }).click();
await page.waitForTimeout(150);
await panelPlano.locator("label", { hasText: "Asistencia de bordes" }).locator('input[type="checkbox"]').uncheck();
await page.waitForTimeout(80);
for (const punto of [{ x: 20, y: 20 }, { x: 580, y: 20 }, { x: 580, y: 580 }, { x: 20, y: 580 }]) {
  await click(punto);
}
await panelPlano.getByPlaceholder("Ej: 60").fill("32"); // 2240px de perímetro -> ~0.0143 m/px (no afecta al test, solo hace falta estar calibrado)
await panelPlano.getByRole("button", { name: "Calibrar", exact: true }).last().click();
await page.waitForTimeout(200);

// --- 1. Trazar pared, con snap de ángulo prendido (default) ---
await panelPlano.getByRole("button", { name: "Trazar pared", exact: true }).click();
await page.waitForTimeout(150);
assert(await panelPlano.getByText("Snap de ángulo (pega cada tramo a 0°/15°/30°/45°... si ya está cerca)").isVisible(), "El toggle de snap de ángulo existe y es visible en modo 'Trazar pared'");

// A=(100,300) -> B=(300,306): ~1.7° de desvío respecto a la horizontal, dentro de la tolerancia (6°) -> debería snapear a horizontal exacto.
await click({ x: 100, y: 300 });
await click({ x: 300, y: 306 });
await page.waitForTimeout(150);

let lista = await circulos();
const nodoA = circuloCercaDe(lista, { x: 100, y: 300 });
assert(!!nodoA, "El nodo A quedó creado donde se clickeó");
const nodoBSnapeado = lista.find((c) => Math.abs(c.cx - 300) < 2 && c.cy !== undefined);
assert(!!nodoBSnapeado, "El nodo B quedó creado cerca de x=300");
assert(Math.abs(nodoBSnapeado.cy - nodoA.cy) < 0.5, `Con snap de ángulo ON, un desvío chico (~1.7°) sale perfectamente horizontal — B.cy (${nodoBSnapeado?.cy}) ≈ A.cy (${nodoA?.cy})`);

// --- 2. Apagar el snap de ángulo y trazar un 2do segmento con el MISMO desvío relativo -> esta vez debe quedar con el desvío real, sin corregir ---
await page.getByText("Snap de ángulo (pega cada tramo a 0°/15°/30°/45°... si ya está cerca)").click();
await page.waitForTimeout(100);

await click({ x: 100, y: 450 }); // C, lejos de A/B para no pegarse a ningún nodo existente
await click({ x: 300, y: 456 }); // D, mismo desvío relativo (~1.7°) que A->B
await page.waitForTimeout(150);

lista = await circulos();
const nodoC = circuloCercaDe(lista, { x: 100, y: 450 });
const nodoD = lista.find((c) => Math.abs(c.cx - 300) < 2 && Math.abs(c.cy - 456) < 3);
assert(!!nodoC && !!nodoD, "C y D quedaron creados");
assert(Math.abs(nodoD.cy - nodoC.cy) > 3, `Con snap de ángulo OFF, el mismo desvío (~1.7°) NO se corrige — D.cy (${nodoD?.cy}) sigue distinto de C.cy (${nodoC?.cy})`);

// --- 3. "Pegar a un nodo existente" sigue funcionando con el snap de ángulo prendido (no lo pisa) ---
await page.getByText("Snap de ángulo (pega cada tramo a 0°/15°/30°/45°... si ya está cerca)").click(); // lo vuelve a prender
await page.waitForTimeout(100);
const cantidadAntes = (await circulos()).length;

// Nuevo trazo desde un punto lejano (E) hacia MUY cerca del nodo A (a menos de 15px, dentro del radio de pegado de 0.3m con esta escala) — en un ángulo cualquiera respecto a E, para que el snap de ángulo NO coincida por casualidad con la dirección exacta hacia A.
await click({ x: 400, y: 100 }); // E
await click({ x: 103, y: 297 }); // a ~4px de A — debería pegarse exacto al nodo A existente, no crear uno nuevo
await page.waitForTimeout(150);

lista = await circulos();
assert(lista.length === cantidadAntes + 1, `El click cerca de A se pegó al nodo EXISTENTE (solo +1 nodo nuevo, el de E) — el snap de ángulo no pisa el pegado a nodo (real: +${lista.length - cantidadAntes})`);
const nodoAIntacto = circuloCercaDe(lista, { x: nodoA.cx, y: nodoA.cy }, 0.5);
assert(!!nodoAIntacto, `El nodo A sigue exactamente en su posición original (${JSON.stringify(nodoA)}) — no se movió ni se duplicó`);

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await browser.close();
