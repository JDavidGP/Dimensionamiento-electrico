// "Plano sin imagen" (v1, sin enganche automático) — usuario, 2026-11-24.
// Muchas instalaciones no tienen plano previo. En vez de obligar a subir
// una imagen, el instalador ingresa el ancho/alto total de la casa (el
// "marco" del rompecabezas) y eso genera una imagen de fondo sintética ya
// calibrada, para que TODA la herramienta existente de Plano (Generar
// ambiente, Mover ambiente, Colocar equipo, etc.) funcione igual que con
// una foto real. El enganche automático entre piezas queda fuera de este
// v1 (confirmado con el usuario) — acá solo se verifica el arrastre libre.
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

assert((await page.getByRole("button", { name: "+ Crear plano sin imagen", exact: true }).count()) === 1, "El botón 'Crear plano sin imagen' existe antes de cargar nada");

await page.getByRole("button", { name: "+ Crear plano sin imagen", exact: true }).click();
await page.waitForTimeout(150);
await page.getByPlaceholder("Ej: 10").fill("10");
await page.getByPlaceholder("Ej: 8").fill("8");
await page.getByPlaceholder("Ej: Casa Familia Pérez").fill("Casa Prueba");
await page.getByRole("button", { name: "+ Crear marco", exact: true }).click();
await page.waitForTimeout(300);

assert((await page.getByText(/Marco de 10m × 8m creado/).count()) >= 1, "Avisa que el marco quedó creado y calibrado");
assert((await page.getByText(/Calibrado:/).count()) >= 1, "Ya quedó calibrado solo, sin pedir calibración manual");
assert((await page.locator("svg image").count()) === 1, "Hay una imagen de fondo sintética (el marco) ya cargada");

await page.getByRole("button", { name: "Generar ambiente", exact: true }).click();
await page.waitForTimeout(150);
await page.getByPlaceholder("Nombre (ej. Habitación #1)").fill("Sala");
await page.getByPlaceholder("Ancho (m)").fill("4");
await page.getByPlaceholder("Alto (m)").fill("3");
let p = await puntoPantallaDesdeImagen({ x: 100, y: 100 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);

await page.getByPlaceholder("Nombre (ej. Habitación #1)").fill("Cocina");
await page.getByPlaceholder("Ancho (m)").fill("3");
await page.getByPlaceholder("Alto (m)").fill("2.5");
p = await puntoPantallaDesdeImagen({ x: 400, y: 400 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);

assert((await page.getByText("Ambientes (2)").count()) >= 1, "Las 2 piezas (Sala, Cocina) quedaron creadas, cada una por su propia medida");

// Mover la "Cocina" — arrastre libre, sin enganche automático (v1 confirmado con el usuario)
await page.getByRole("button", { name: "Mover ambiente", exact: true }).click();
await page.waitForTimeout(150);
const pInicio = await puntoPantallaDesdeImagen({ x: 400, y: 400 });
const pFin = await puntoPantallaDesdeImagen({ x: 700, y: 200 });
await page.mouse.move(pInicio.x, pInicio.y);
await page.mouse.down();
await page.mouse.move((pInicio.x + pFin.x) / 2, (pInicio.y + pFin.y) / 2, { steps: 5 });
await page.mouse.move(pFin.x, pFin.y, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(300);
assert((await page.getByText("Ambientes (2)").count()) >= 1, "Mover una pieza no crea ni borra ninguna (siguen siendo 2)");

// La imagen de fondo sintética se puede ocultar igual que una foto real (misma función ya existente)
await page.getByText("Imagen de fondo", { exact: true }).click();
await page.waitForTimeout(150);
assert((await page.locator("svg image").count()) === 0, "Se puede ocultar el marco sintético una vez armadas las piezas");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/plano_sin_imagen.png", fullPage: true });
await browser.close();
