// Instalación de interiores y exteriores en el Plano — UI en vivo.
// Usuario, 2026-11-25: "por medio de ambiente... separar lo interior
// del hogar de lo exterior, como puede ser un cobertizo, luces de
// exteriores, alguna bomba... en un cuarto aparte". Cada ambiente se
// marca exterior=true/false; un equipo colocado adentro HEREDA la
// condición (ver habitacionQueContiene, probada aparte en
// test_interior_exterior_plano.mjs), nunca se copia aparte.
import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
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

await page.getByRole("button", { name: "+ Crear plano sin imagen", exact: true }).click();
await page.waitForTimeout(150);
await page.getByPlaceholder("Ej: 10").fill("10");
await page.getByPlaceholder("Ej: 8").fill("8");
await page.getByRole("button", { name: "+ Crear marco", exact: true }).click();
await page.waitForTimeout(300);

// Sala (interior, default) y Cobertizo
await page.getByRole("button", { name: "Generar ambiente", exact: true }).click();
await page.waitForTimeout(150);
await page.getByPlaceholder("Nombre (ej. Habitación #1)").fill("Sala");
await page.getByPlaceholder("Ancho (m)").fill("3");
await page.getByPlaceholder("Largo (m)").fill("3");
let p = await puntoPantallaDesdeImagen({ x: 2 * 120, y: 2 * 120 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);

await page.getByPlaceholder("Nombre (ej. Habitación #1)").fill("Cobertizo");
await page.getByPlaceholder("Ancho (m)").fill("3");
await page.getByPlaceholder("Largo (m)").fill("3");
p = await puntoPantallaDesdeImagen({ x: 7 * 120, y: 2 * 120 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);

assert((await page.getByText("Ambientes (2)").count()) >= 1, "Sala y Cobertizo creados");
assert((await page.locator('label:has-text("Exterior") input[type="checkbox"]:checked').count()) === 0, "Ningún ambiente arranca marcado exterior (interior por defecto)");

const checkboxesExterior = page.locator('label:has-text("Exterior") input[type="checkbox"]');
assert((await checkboxesExterior.count()) === 2, "Hay un checkbox 'Exterior' por cada ambiente");
await checkboxesExterior.nth(1).check(); // Cobertizo es el 2do ambiente creado
await page.waitForTimeout(150);
assert((await page.locator('label:has-text("Exterior") input[type="checkbox"]:checked').count()) === 1, "Cobertizo queda marcado exterior");

// Equipo colocado en Sala (interior)
await page.getByRole("button", { name: "Colocar equipo", exact: true }).click();
await page.waitForTimeout(150);
p = await puntoPantallaDesdeImagen({ x: 2 * 120, y: 2 * 120 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);

const panelEquipos = page.getByText("Equipos en el plano", { exact: false }).locator("xpath=..").first();
assert((await page.getByText("Equipos en el plano (1)").count()) >= 1, "Equipo colocado en Sala");
assert((await panelEquipos.getByText("Interior", { exact: true }).count()) === 1, "El equipo en Sala muestra la etiqueta 'Interior' — heredada del ambiente, no pedida aparte");

// Equipo colocado en Cobertizo (exterior)
p = await puntoPantallaDesdeImagen({ x: 7 * 120, y: 2 * 120 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);

assert((await page.getByText("Equipos en el plano (2)").count()) >= 1, "2 equipos colocados");
assert((await panelEquipos.getByText("Exterior", { exact: true }).count()) === 1, "El equipo en Cobertizo muestra la etiqueta 'Exterior' — mismo ambiente marcado, sin re-marcar el equipo");

// Equipo fuera de cualquier ambiente trazado
p = await puntoPantallaDesdeImagen({ x: 1 * 120, y: 7 * 120 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);
assert((await panelEquipos.getByText("Sin ambiente", { exact: true }).count()) === 1, "Un equipo fuera de cualquier ambiente muestra 'Sin ambiente' — no asume interior por defecto");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/interior_exterior_plano.png", fullPage: true });
await browser.close();
