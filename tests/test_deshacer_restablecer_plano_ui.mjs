// Deshacer / Restablecer en Plano — usuario, 2026-11-25: "hace falta
// dos botones importantes en plano, el de restablecer y regresar de
// una acción" (feedback tras probar el proyecto exportado localmente).
// "Deshacer" cubre mutaciones ESTRUCTURALES (crear/borrar/mover pared,
// ambiente, ruta, equipo) — NO cubre edición de texto libre (renombrar,
// altura), que dispara por cada tecla tipeada (ver la nota larga en
// useCircuitos.js, junto a guardarPuntoDeshacerPlano). "Restablecer"
// limpia el trazado (nodos/segmentos/habitaciones/rutas/marcadores)
// SIN tocar la imagen/calibración ya cargada, y guarda su propio punto
// de deshacer (un "Deshacer" justo después de un "Restablecer" por
// error trae todo de vuelta).
import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
page.on("dialog", (d) => d.accept());
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

assert((await page.getByRole("button", { name: "↶ Deshacer", exact: true }).count()) === 0, "Sin plano cargado, no muestra Deshacer");
assert((await page.getByRole("button", { name: "↺ Restablecer", exact: true }).count()) === 0, "Sin plano cargado, no muestra Restablecer");

await page.getByRole("button", { name: "+ Crear plano sin imagen", exact: true }).click();
await page.waitForTimeout(150);
await page.getByPlaceholder("Ej: 10").fill("10");
await page.getByPlaceholder("Ej: 8").fill("8");
await page.getByRole("button", { name: "+ Crear marco", exact: true }).click();
await page.waitForTimeout(300);

const btnDeshacer = page.getByRole("button", { name: "↶ Deshacer", exact: true });
assert((await btnDeshacer.count()) === 1, "Con plano cargado, aparece el botón Deshacer");
assert(await btnDeshacer.isDisabled(), "Deshacer arranca deshabilitado (nada que deshacer todavía)");
assert((await page.getByRole("button", { name: "↺ Restablecer", exact: true }).count()) === 0, "Sin nada trazado todavía, Restablecer no aparece");

await page.getByRole("button", { name: "Generar ambiente", exact: true }).click();
await page.waitForTimeout(150);
await page.getByPlaceholder("Nombre (ej. Habitación #1)").fill("Sala");
await page.getByPlaceholder("Ancho (m)").fill("3");
await page.getByPlaceholder("Largo (m)").fill("3");
let p = await puntoPantallaDesdeImagen({ x: 2 * 120, y: 2 * 120 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);

assert((await page.getByText("Ambientes (1)").count()) >= 1, "Ambiente creado");
assert(!(await btnDeshacer.isDisabled()), "Tras crear el ambiente, Deshacer ya está habilitado");
assert((await page.getByRole("button", { name: "↺ Restablecer", exact: true }).count()) === 1, "Con algo trazado, Restablecer aparece");

await btnDeshacer.click();
await page.waitForTimeout(200);
assert((await page.getByText("Ambientes (0)").count()) >= 1, "Deshacer quita el ambiente recién creado");
assert(await btnDeshacer.isDisabled(), "Sin más historial, Deshacer vuelve a deshabilitarse");

await page.getByPlaceholder("Nombre (ej. Habitación #1)").fill("Sala");
p = await puntoPantallaDesdeImagen({ x: 2 * 120, y: 2 * 120 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);
await page.getByPlaceholder("Nombre (ej. Habitación #1)").fill("Cocina");
p = await puntoPantallaDesdeImagen({ x: 7 * 120, y: 2 * 120 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);
assert((await page.getByText("Ambientes (2)").count()) >= 1, "2 ambientes creados");

await page.getByRole("button", { name: "↺ Restablecer", exact: true }).click();
await page.waitForTimeout(200);
assert((await page.getByText("Ambientes (0)").count()) >= 1, "Restablecer borra ambos ambientes");
assert((await page.getByText(/Calibrado:/).count()) >= 1, "Restablecer NO borra la calibración/imagen (sigue calibrado)");

await btnDeshacer.click();
await page.waitForTimeout(200);
assert((await page.getByText("Ambientes (2)").count()) >= 1, "Deshacer justo después de Restablecer trae los 2 ambientes de vuelta");

// Arrastre (Mover ambiente) cuenta como UNA sola acción de deshacer, no una por cada evento de puntero durante el gesto
await page.getByRole("button", { name: "Mover ambiente", exact: true }).click();
await page.waitForTimeout(150);
const desde = await puntoPantallaDesdeImagen({ x: 2 * 120, y: 2 * 120 });
const hasta = await puntoPantallaDesdeImagen({ x: 4 * 120, y: 4 * 120 });
await page.mouse.move(desde.x, desde.y);
await page.mouse.down();
await page.mouse.move((desde.x + hasta.x) / 2, (desde.y + hasta.y) / 2, { steps: 8 });
await page.mouse.move(hasta.x, hasta.y, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(200);

await btnDeshacer.click();
await page.waitForTimeout(200);
const circulos = await page.locator("svg > g circle").evaluateAll((els) => els.map((e) => ({ cx: parseFloat(e.getAttribute("cx")), cy: parseFloat(e.getAttribute("cy")) })));
// Esquina superior-izquierda original de "Sala" (3x3 centrada en (2,2) en metros = esquina en (0.5,0.5) × 120 px/m): image (60,60)
const volvioAlOrigen = circulos.some((c) => Math.abs(c.cx - 60) < 3 && Math.abs(c.cy - 60) < 3);
assert(volvioAlOrigen, "Un solo 'Deshacer' revierte TODO el arrastre (no solo el último pixel movido del gesto)");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/deshacer_restablecer_plano.png", fullPage: true });
await browser.close();
