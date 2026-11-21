// Pegar una ruta de conductor a la posición EXACTA de un equipo
// marcado — usuario, 2026-11-22, "seguimos con pegar ruta del
// conductor" (el último de los 3 puntos diferidos de
// PLANO_INTELIGENTE_DISENO.md §12). Prueba que un click de trazado de
// conductor CERCA (no exacto) de un marcador de equipo crea el nodo
// EN EL PUNTO EXACTO del marcador, no en el click aproximado —
// comparando la longitud resultante contra los 2 valores posibles
// (con vs. sin snap), que son deliberadamente distintos.
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

// --- 1. Calibrar (32m / 1600px = 0.02 m/px) ---
await panelPlano.getByRole("button", { name: "Calibrar por perímetro", exact: true }).click();
await page.waitForTimeout(150);
await panelPlano.locator("label", { hasText: "Asistencia de bordes" }).locator('input[type="checkbox"]').uncheck();
await page.waitForTimeout(80);
for (const punto of [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 500 }, { x: 100, y: 500 }]) {
  await click(punto);
}
await panelPlano.getByPlaceholder("Ej: 60").fill("32");
await panelPlano.getByRole("button", { name: "Calibrar", exact: true }).last().click();
await page.waitForTimeout(200);

// --- 2. Colocar un equipo en (300,300) de imagen ---
await panelPlano.getByRole("button", { name: "Colocar equipo", exact: true }).click();
await page.waitForTimeout(150);
await click({ x: 300, y: 300 });
await page.waitForTimeout(200);
assert(await panelPlano.getByText("Equipos en el plano (1)").isVisible(), "Se colocó 1 equipo en el plano");

// --- 3. Trazar un conductor: primer click CERCA del equipo (305,295 — a 0.14m en diagonal, dentro del radio de pegado de 0.3m), segundo click en (100,300) ---
await panelPlano.getByRole("button", { name: "Trazar conductor", exact: true }).click();
await page.waitForTimeout(100);
await click({ x: 305, y: 295 });
await click({ x: 100, y: 300 });
await panelPlano.getByRole("button", { name: /Terminar ruta/ }).click();
await page.waitForTimeout(200);

const textoRuta = await panelPlano.getByText(/longitud trazada/).textContent();
const longitudReal = parseFloat(textoRuta.match(/longitud trazada ([\d.]+) m/)[1]);

// Si pegó al equipo (300,300 exacto): distancia a (100,300) = 200px*0.02 = 4.00m exactos.
// Si NO pegó (usó el click crudo en 305,295): distancia a (100,300) = hypot(205,-5)*0.02 ≈ 4.10m.
// Los dos valores están separados ~0.10m — de sobra para distinguir con la tolerancia de redondeo de píxeles de pantalla.
assert(Math.abs(longitudReal - 4.0) < 0.03, `El conductor se pegó al punto EXACTO del equipo (300,300) -> longitud ≈4.00m, no ≈4.10m del click aproximado (real: ${longitudReal}m)`);
assert(Math.abs(longitudReal - 4.1) > 0.03, `Confirmación: la longitud NO coincide con el valor "sin pegar" (≈4.10m) (real: ${longitudReal}m)`);

await page.screenshot({ path: DIR + "tmp/plano_pegar_conductor_equipo.png", fullPage: true });

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await browser.close();
