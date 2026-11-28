// Amontonamiento de números en modo "Mover ambiente" (usuario,
// 2026-11-28, viendo varios ambientes juntos/encimados: "se ve un montón
// de números que... se puede confundir o no entender"). Antes de esto,
// en modo "Mover ambiente" el nombre + área/perímetro de TODOS los
// ambientes se mostraban siempre, sin importar cuál se estuviera
// arrastrando — ahora solo se muestran los del ambiente que se está
// arrastrando (igual que "resaltada" por click en modo "Mover vista"),
// el resto queda oculto hasta que lo toques/arrastres/pases el cursor.
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

const svg = () => page.locator("svg").last();
async function puntoPantallaDesdeImagen(puntoImagen) {
  const box = await svg().boundingBox();
  const transformAttr = await page.locator("svg > g").last().getAttribute("transform");
  const m = transformAttr.match(/translate\(([-\d.]+),([-\d.]+)\) scale\(([-\d.]+)\)/);
  const panX = parseFloat(m[1]), panY = parseFloat(m[2]), zoom = parseFloat(m[3]);
  return { x: box.x + puntoImagen.x * zoom + panX, y: box.y + puntoImagen.y * zoom + panY };
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

// Ambiente A: 3x3 en (2,2). Ambiente B: 3x3 en (6,2) — lejos de A, sin tocarse.
await page.getByRole("button", { name: "Generar ambiente", exact: true }).click();
await page.waitForTimeout(150);
await page.getByPlaceholder("Nombre (ej. Habitación #1)").fill("Dormitorio");
await page.getByPlaceholder("Ancho (m)").fill("3");
await page.getByPlaceholder("Largo (m)").fill("3");
let p = await puntoPantallaDesdeImagen({ x: 2 * 120, y: 2 * 120 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);

await page.getByPlaceholder("Nombre (ej. Habitación #1)").fill("Cocina");
await page.getByPlaceholder("Ancho (m)").fill("3");
await page.getByPlaceholder("Largo (m)").fill("3");
p = await puntoPantallaDesdeImagen({ x: 6 * 120, y: 2 * 120 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);

assert((await page.getByText("Ambientes (2)").count()) >= 1, "Dormitorio y Cocina quedaron creados");

// --- "Mover ambiente" ---
await page.getByRole("button", { name: "Mover ambiente", exact: true }).click();
await page.waitForTimeout(150);

assert((await svg().getByText("Dormitorio", { exact: true }).count()) === 0, "Sin arrastrar nada, el nombre de 'Dormitorio' está oculto");
assert((await svg().getByText("Cocina", { exact: true }).count()) === 0, "...y el de 'Cocina' también");
assert((await svg().getByText("9.00m² · 12.00m perímetro").count()) === 0, "Ningún área/perímetro visible sin arrastrar nada (antes se mostraban SIEMPRE los 2)");

// --- Arrastrar 'Dormitorio' (mousedown + move, SIN soltar todavía) ---
const desde = await puntoPantallaDesdeImagen({ x: 2 * 120, y: 2 * 120 });
await page.mouse.move(desde.x, desde.y);
await page.mouse.down();
await page.mouse.move(desde.x + 15, desde.y + 15, { steps: 5 });
await page.waitForTimeout(150);

assert((await svg().getByText("Dormitorio", { exact: true }).count()) === 1, "Arrastrando 'Dormitorio', su nombre se revela");
assert((await svg().getByText("Cocina", { exact: true }).count()) === 0, "...pero el de 'Cocina' sigue oculto (no se amontonan los 2)");
assert((await svg().getByText("9.00m² · 12.00m perímetro").count()) === 1, "Solo el área/perímetro de 'Dormitorio' (el que se arrastra) está visible, no los 2");

await page.mouse.up();
// El cursor queda posado sobre 'Dormitorio' tras soltar — el hover
// (independiente del arrastre) seguiría revelando su nombre, así que
// hay que sacarlo de encima para comprobar que YA NO se está
// arrastrando (igual truco que test_nombre_ambiente_al_tocar_ui.mjs).
const afuera = await puntoPantallaDesdeImagen({ x: 0.2 * 120, y: 7.5 * 120 });
await page.mouse.move(afuera.x, afuera.y);
await page.waitForTimeout(200);

assert((await svg().getByText("Dormitorio", { exact: true }).count()) === 0, "Al soltar y sacar el cursor, el nombre de 'Dormitorio' se oculta de nuevo (ya no se está arrastrando)");
assert((await svg().getByText("9.00m² · 12.00m perímetro").count()) === 0, "...y su área/perímetro también");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/amontonamiento_mover_ambiente.png", fullPage: true });
await browser.close();
