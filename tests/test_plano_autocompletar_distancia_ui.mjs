// Autocompletar distancia del circuito desde la longitud ya trazada en
// el plano — usuario, 2026-11-22, "sigamos con la autocompletar
// distancia desde el plano". Prueba la UI real: trazar una ruta,
// crear un circuito, vincular la ruta a ese circuito, usar "Usar esta
// longitud" y confirmar que el campo Distancia (m) del circuito
// refleja el valor calculado.
import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1300 } });
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

// --- 1. Crear un circuito primero (para que exista como candidato) ---
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Ej: Iluminación cocina").fill("Circuito plano");
await page.locator("label:has-text('Distancia (m)')").locator("..").locator("input").fill("1");
await page.getByRole("button", { name: "+ Crear circuito" }).click();
await page.waitForTimeout(200);

// --- 2. Ir al Plano, cargar imagen, calibrar y trazar un conductor recto de 5m ---
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

await panelPlano.getByRole("button", { name: "Calibrar por perímetro", exact: true }).click();
await page.waitForTimeout(150);
await panelPlano.locator("label", { hasText: "Asistencia de bordes" }).locator('input[type="checkbox"]').uncheck();
await page.waitForTimeout(80);
for (const punto of [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 500 }, { x: 100, y: 500 }]) {
  await click(punto);
}
await panelPlano.getByPlaceholder("Ej: 60").fill("32"); // 1600px -> 0.02 m/px
await panelPlano.getByRole("button", { name: "Calibrar", exact: true }).last().click();
await page.waitForTimeout(200);

// Conductor recto de (100,300) a (350,300): 250px * 0.02 m/px = 5m exactos, sin cruzar ninguna pared.
await panelPlano.getByRole("button", { name: "Trazar conductor", exact: true }).click();
await page.waitForTimeout(100);
await click({ x: 100, y: 300 });
await click({ x: 350, y: 300 });
await panelPlano.getByRole("button", { name: /Terminar ruta/ }).click();
await page.waitForTimeout(200);

const textoRutaAntes = await panelPlano.getByText(/longitud trazada/).textContent();
assert(/longitud trazada 4\.9\d m/.test(textoRutaAntes), `Ruta trazada ≈5m, sin cruces (real: '${textoRutaAntes}')`);
assert(!/cruce/.test(textoRutaAntes), "Sin cruces de pared en esta ruta (recta, lejos de la pared calibrada)");

// --- 3. Vincular la ruta al circuito recién creado ---
await panelPlano.locator("select").filter({ hasText: "Vincular a" }).selectOption({ label: "Circuito plano" });
await page.waitForTimeout(150);

assert(await panelPlano.getByText(/Distancia actual: 1\.00 m/).isVisible(), "Muestra la distancia ACTUAL del circuito (1m, la que pusimos al crearlo) antes de aplicar nada");

// --- 4. Usar esta longitud ---
await panelPlano.getByRole("button", { name: /Usar esta longitud/ }).click();
await page.waitForTimeout(200);

assert(await panelPlano.getByText(/Distancia actual: 4\.9\d m/).isVisible(), "Tras 'Usar esta longitud', la distancia actual ya refleja los ~5m de la ruta trazada");

// --- 5. Confirmar en la pestaña de Circuitos que el campo realmente cambió ---
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Editar circuito Circuito plano" }).click();
await page.waitForTimeout(200);
const valorDistancia = await page.locator("label:has-text('Distancia (m)')").locator("..").locator("input").inputValue();
assert(Math.abs(parseFloat(valorDistancia) - 5) < 0.1, `El campo Distancia (m) del circuito real quedó en ~5 (real: '${valorDistancia}')`);

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await browser.close();
