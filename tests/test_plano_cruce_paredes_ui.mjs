// Motor geométrico de cruces de pared + toggle de capas — usuario,
// 2026-11-22, "empecemos con el espesor de pared conectado a un
// cálculo real... crear un motor que realice cálculos geométricos más
// exacto" + "necesitamos algo visual que separe las líneas de las
// paredes con las rutas de los conductores". Prueba la UI real:
// trazar una pared con espesor medido, trazar un conductor que la
// cruza perpendicular, verificar que el extra de longitud aparece en
// la tarjeta de la ruta — y que el toggle "Paredes" oculta/muestra la
// línea verde de la pared en el lienzo sin afectar la del conductor.
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

await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);
await page.locator('input[type="file"][accept="image/*,application/pdf"]').setInputFiles(
  DIR + "fixtures/plano_test.png"
);
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

// --- 1. Calibrar por perímetro (mismo patrón que test_plano_perimetro_espesor_ui.mjs) ---
await panelPlano.getByRole("button", { name: "Calibrar por perímetro", exact: true }).click();
await page.waitForTimeout(150);
await panelPlano.locator("label", { hasText: "Asistencia de bordes" }).locator('input[type="checkbox"]').uncheck();
await page.waitForTimeout(80);
for (const punto of [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 500 }, { x: 100, y: 500 }]) {
  await click(punto);
}
await panelPlano.getByPlaceholder("Ej: 60").fill("32"); // 1600px perímetro -> 0.02 m/px
await panelPlano.getByRole("button", { name: "Calibrar", exact: true }).last().click();
await page.waitForTimeout(200);

// --- 2. Trazar una pared horizontal (150,150)-(450,150) ---
await click({ x: 150, y: 150 });
await click({ x: 450, y: 150 });
await panelPlano.getByRole("button", { name: "Trazar pared", exact: true }).click();
await page.waitForTimeout(100);

// --- 3. Medir su espesor (2 clicks a los lados, en x=300) ---
await panelPlano.getByRole("button", { name: "Medir espesor", exact: true }).click();
await page.waitForTimeout(100);
await click({ x: 300, y: 145 });
await click({ x: 300, y: 155 });
await page.waitForTimeout(150);
const textoEspesor = await page.getByText(/Espesor guardado: [\d.]+ cm/).textContent();
const espesorCm = parseFloat(textoEspesor.match(/([\d.]+) cm/)[1]);
assert(espesorCm > 0, `Espesor medido y guardado (real: ${espesorCm}cm)`);

// --- 4. Trazar un conductor vertical que cruza esa pared PERPENDICULAR, en x=300 ---
await panelPlano.getByRole("button", { name: "Trazar conductor", exact: true }).click();
await page.waitForTimeout(100);
await click({ x: 300, y: 50 });
await click({ x: 300, y: 300 });
await panelPlano.getByRole("button", { name: /Terminar ruta/ }).click();
await page.waitForTimeout(200);

// --- 5. La tarjeta de la ruta muestra el extra por cruce de pared, consistente con el espesor medido ---
const textoRuta = await panelPlano.getByText(/longitud trazada/).textContent();
assert(/cruce.*de pared/.test(textoRuta), `La tarjeta de la ruta reporta el cruce de pared (real: '${textoRuta}')`);
const matchExtra = textoRuta.match(/\+([\d.]+) m por/);
assert(matchExtra, `Se encuentra el extra en metros en el texto (real: '${textoRuta}')`);
if (matchExtra) {
  const extraM = parseFloat(matchExtra[1]);
  const espesorM = espesorCm / 100;
  // Cruce perpendicular -> extra ≈ espesorM exacto (misma tolerancia de redondeo de píxeles que el resto del test).
  assert(Math.abs(extraM - espesorM) < 0.02, `Cruce perpendicular: extra (${extraM}m) ≈ espesor medido (${espesorM}m)`);
}
const matchTotal = textoRuta.match(/total ([\d.]+) m/);
assert(matchTotal, `Se encuentra la longitud total en el texto (real: '${textoRuta}')`);

await page.screenshot({ path: DIR + "tmp/plano_cruce_paredes.png", fullPage: true });

// --- 6. Toggle de capas: ocultar "Paredes" quita la línea verde de la pared del lienzo, sin afectar la del conductor ---
const lineasParedAntes = await svgPlano.locator('line[stroke="#7FA66B"]').count();
assert(lineasParedAntes >= 1, `Antes de ocultar, la línea de la pared (verde, #7FA66B) está en el lienzo (real: ${lineasParedAntes})`);
const lineasConductorAntes = await svgPlano.locator('line[stroke="#C9793D"]').count();
assert(lineasConductorAntes >= 1, `La línea del conductor (cobre, #C9793D) también está (real: ${lineasConductorAntes})`);

await panelPlano.locator("label", { hasText: "Paredes" }).locator('input[type="checkbox"]').uncheck();
await page.waitForTimeout(150);
const lineasParedDespues = await svgPlano.locator('line[stroke="#7FA66B"]').count();
assert(lineasParedDespues === 0, `Al desmarcar "Paredes", la línea verde desaparece del lienzo (real: ${lineasParedDespues})`);
const lineasConductorDespues = await svgPlano.locator('line[stroke="#C9793D"]').count();
assert(lineasConductorDespues === lineasConductorAntes, "El conductor sigue visible — el toggle de paredes no lo afecta");

await page.screenshot({ path: DIR + "tmp/plano_capas_ocultas.png", fullPage: true });

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await browser.close();
