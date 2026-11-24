// "Generar grupo" + "Mover equipo" en Plano — usuario, 2026-11-24:
// "selecciona conmutado, elegí la cantidad de interruptores y luces
// quiere, genera un grupo con esa cantidad de equipo que puedes mover
// a placer además se puede numerar y etiquetar mejor de esa forma".
// Hasta ahora un equipo colocado no se podía reposicionar (solo
// borrar y volver a crear) — "Mover equipo" es nuevo para CUALQUIER
// marcador, no solo los generados en grupo.
import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
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
await page.locator('input[type="file"][accept="image/*,application/pdf"]').setInputFiles(DIR + "fixtures/plano_test.png");
await page.waitForTimeout(400);

// --- 1. Sin calibrar: "Generar grupo" avisa en vez de fallar en silencio ---
await page.getByRole("button", { name: "Generar grupo", exact: true }).click();
await page.waitForTimeout(150);
let p = await puntoPantallaDesdeImagen({ x: 300, y: 300 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);
assert((await page.getByText(/Calibrá el plano primero/).count()) >= 1, "Sin calibrar, 'Generar grupo' avisa en vez de fallar en silencio");
assert((await page.getByText(/Equipos en el plano \(0\)/).count()) >= 1, "No se creó ningún equipo sin calibrar");

// --- 2. Calibrar (400px = 5m) ---
await page.getByRole("button", { name: "Calibrar", exact: true }).click();
await page.waitForTimeout(150);
p = await puntoPantallaDesdeImagen({ x: 100, y: 100 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(100);
p = await puntoPantallaDesdeImagen({ x: 500, y: 100 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(150);
await page.getByPlaceholder("Ej: 5").fill("5");
await page.getByRole("button", { name: "Calibrar", exact: true }).last().click();
await page.waitForTimeout(200);

// --- 3. Generar un grupo de 4 "Luminaria", nombre base "Luz" ---
await page.getByRole("button", { name: "Generar grupo", exact: true }).click();
await page.waitForTimeout(150);
await page.locator("select").nth(2).selectOption({ label: "Luminaria" });
await page.getByPlaceholder(/Nombre base/).fill("Luz");
await page.getByTitle("Cantidad a generar").fill("4");
assert(
  (await page.getByText(/Vincular a/).count()) === 0,
  "Un grupo no ofrece 'Vincular a' (serían N marcadores compartiendo 1 solo vínculo, no tiene sentido)"
);
p = await puntoPantallaDesdeImagen({ x: 300, y: 300 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(300);
assert((await page.getByText(/Equipos en el plano \(4\)/).count()) >= 1, "Se generaron los 4 equipos del grupo de una sola vez");
assert((await page.locator('input[value="Luz 1"]').count()) >= 1, "El primero quedó numerado 'Luz 1'");
assert((await page.locator('input[value="Luz 4"]').count()) >= 1, "El último quedó numerado 'Luz 4'");

// --- 4. Cantidad inválida (0) avisa, no crea nada ---
await page.getByTitle("Cantidad a generar").fill("0");
p = await puntoPantallaDesdeImagen({ x: 100, y: 500 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);
assert((await page.getByText(/Cantidad inválida/).count()) >= 1, "Cantidad 0 avisa en vez de crear un grupo vacío o fallar en silencio");
assert((await page.getByText(/Equipos en el plano \(4\)/).count()) >= 1, "Sigue habiendo solo 4 equipos (la cantidad inválida no creó nada)");

// --- 5. "Mover equipo": arrastrar "Luz 1" (en 300+18=318, 300+18=318 imagen) a otra posición ---
await page.getByRole("button", { name: "Mover equipo", exact: true }).click();
await page.waitForTimeout(150);
const pInicio = await puntoPantallaDesdeImagen({ x: 318, y: 318 });
const pFin = await puntoPantallaDesdeImagen({ x: 450, y: 150 });
await page.mouse.move(pInicio.x, pInicio.y);
await page.mouse.down();
await page.mouse.move((pInicio.x + pFin.x) / 2, (pInicio.y + pFin.y) / 2, { steps: 5 });
await page.mouse.move(pFin.x, pFin.y, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(300);
assert((await page.getByText(/Equipos en el plano \(4\)/).count()) >= 1, "Mover un equipo no crea ni borra ninguno (siguen siendo 4)");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await browser.close();
