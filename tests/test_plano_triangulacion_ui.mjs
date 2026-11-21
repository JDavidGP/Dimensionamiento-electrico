// Triangulación por recorrido (usuario, 2026-11-21): ubicar un equipo
// midiendo su distancia (cinta métrica) a 2 puntos YA conocidos del
// plano, en vez de hacer click directo sobre la imagen — pensado para
// cuando se puede medir pero no se puede "ver" exactamente dónde cae
// el punto en la foto/plano. Prueba de punta a punta con Playwright:
// calibrar, trazar una pared de referencia (2 nodos conocidos),
// triangular un equipo desde esos 2 nodos, y confirmar con el click
// aproximado que desambigua cuál de las 2 soluciones es la correcta.
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
  DIR + "fixtures/plano_lineas_test.png"
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

// --- 1. Calibrar: pared superior, 50->350px = 300px = 6m real -> ~0.02 m/px ---
await panelPlano.getByRole("button", { name: "Calibrar", exact: true }).click();
await page.waitForTimeout(150);
let p = await puntoPantallaDesdeImagen({ x: 50, y: 50 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(80);
p = await puntoPantallaDesdeImagen({ x: 350, y: 50 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(80);
await panelPlano.getByPlaceholder("Ej: 5").fill("6");
await panelPlano.getByRole("button", { name: "Calibrar", exact: true }).last().click();
await page.waitForTimeout(200);
assert(await panelPlano.getByText(/Calibrado:/).last().isVisible(), "Calibración lista (hace falta escala para triangular)");

// --- 2. Trazar una pared corta de referencia: (50,50) -> (150,50), ~2m, sin asistencia de bordes para que el click caiga EXACTO ---
await panelPlano.getByRole("button", { name: "Trazar pared", exact: true }).click();
await page.waitForTimeout(100);
await panelPlano.locator("label", { hasText: "Asistencia de bordes" }).locator('input[type="checkbox"]').uncheck();
await page.waitForTimeout(80);
p = await puntoPantallaDesdeImagen({ x: 50, y: 50 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(80);
p = await puntoPantallaDesdeImagen({ x: 150, y: 50 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(80);
await panelPlano.getByRole("button", { name: "Terminar este trazo sin cerrar" }).click();
await page.waitForTimeout(100);

// --- 3. Triangular un equipo desde esos 2 nodos ---
await panelPlano.getByRole("button", { name: "Triangular equipo", exact: true }).click();
await page.waitForTimeout(100);

p = await puntoPantallaDesdeImagen({ x: 50, y: 50 }); // nodo A (referencia 1)
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(80);
let estado = await panelPlano.getByText(/de 2 referencias elegidas/).textContent();
assert(/1 de 2 referencias elegidas/.test(estado), `Primera referencia tomada (real: '${estado}')`);

p = await puntoPantallaDesdeImagen({ x: 150, y: 50 }); // nodo B (referencia 2)
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(80);
assert(await panelPlano.getByText(/completá las 2 distancias/).isVisible(), "Las 2 referencias quedaron listas, pide las distancias");

// Target real (elegido para esta prueba): modelo (1.5, 4) — nodoA=(1,1), nodoB=(3,1) aprox (con escala ~0.02 m/px).
// dA = dist((1,1),(1.5,4)) ≈ 3.04 ; dB = dist((3,1),(1.5,4)) ≈ 3.35
await panelPlano.getByPlaceholder("Ej: 2.5").fill("3.04");
await panelPlano.getByPlaceholder("Ej: 3.1").fill("3.35");
await panelPlano.getByRole("button", { name: "Calcular", exact: true }).click();
await page.waitForTimeout(150);
assert(await panelPlano.getByText(/punto\(s\) posible\(s\)/).isVisible(), "Calculó 1 o 2 puntos candidatos");

const equiposAntes = Number((await panelPlano.getByText(/Equipos en el plano/).textContent()).match(/\((\d+)\)/)[1]);
assert(equiposAntes === 0, `Todavía no hay ningún equipo en el plano (real: ${equiposAntes})`);

// Click aproximado cerca del target real (1.5,4)m -> imagen (75,200)px.
p = await puntoPantallaDesdeImagen({ x: 75, y: 200 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);

const equiposDespues = Number((await panelPlano.getByText(/Equipos en el plano/).textContent()).match(/\((\d+)\)/)[1]);
assert(equiposDespues === 1, `El equipo se creó por triangulación (real: ${equiposDespues})`);
assert((await panelPlano.getByText(/punto\(s\) posible\(s\)/).count()) === 0, "El estado de triangulación se limpia después de confirmar");

// --- 4. Encadenamiento: el equipo recién triangulado sirve de referencia para el siguiente ---
await panelPlano.getByRole("button", { name: "Triangular equipo", exact: true }).click();
await page.waitForTimeout(100);
p = await puntoPantallaDesdeImagen({ x: 75, y: 200 }); // justo donde quedó el equipo recién creado
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(80);
estado = await panelPlano.getByText(/de 2 referencias elegidas/).textContent();
assert(/1 de 2 referencias elegidas/.test(estado), `El equipo recién triangulado se puede usar como referencia (real: '${estado}')`);

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await page.screenshot({ path: DIR + "tmp/plano_triangulacion.png", fullPage: true });
await browser.close();
