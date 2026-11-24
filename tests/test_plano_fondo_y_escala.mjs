// Ocultar imagen de fondo + escalar símbolo de equipo al tamaño real
// — usuario, 2026-11-24: "una vez realizado el trazado y calibrado...
// quitarlo... para tener una imagen más nítida y profesional" y
// "hacer más fácil también elegir el equipo... que se escale al
// tamaño del plano para una mejor presentación".
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

// --- 1. Imagen de fondo visible por defecto, toggle la oculta sin borrar el dato ---
assert((await page.locator("svg image").count()) === 1, "La imagen de fondo está visible por defecto");
await page.getByText("Imagen de fondo", { exact: true }).click();
await page.waitForTimeout(150);
assert((await page.locator("svg image").count()) === 0, "Destildar 'Imagen de fondo' la oculta (vista más limpia)");
await page.getByText("Imagen de fondo", { exact: true }).click();
await page.waitForTimeout(150);
assert((await page.locator("svg image").count()) === 1, "Volver a tildarla la muestra de nuevo — el dato seguía ahí");

// --- 2. Calibrar (400px = 5m -> 0.0125 m/px) y colocar un equipo ---
await page.getByRole("button", { name: "Calibrar", exact: true }).click();
await page.waitForTimeout(150);
let p = await puntoPantallaDesdeImagen({ x: 100, y: 100 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(100);
p = await puntoPantallaDesdeImagen({ x: 500, y: 100 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(150);
await page.getByPlaceholder("Ej: 5").fill("5");
await page.getByRole("button", { name: "Calibrar", exact: true }).last().click();
await page.waitForTimeout(200);

await page.getByRole("button", { name: "Colocar equipo", exact: true }).click();
await page.waitForTimeout(150);
p = await puntoPantallaDesdeImagen({ x: 300, y: 300 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(300);

// --- 3. El símbolo escala con el zoom (0.3m de presentación / 0.0125 m/px = 24px al zoom inicial) ---
const circuloMarcador = page.locator("svg circle").last();
const boxInicial = await circuloMarcador.boundingBox();
assert(boxInicial.width > 14 && boxInicial.width < 48, `El tamaño cae en el rango de presentación esperado (real: ${boxInicial.width.toFixed(1)}px)`);

const puntoZoom = await puntoPantallaDesdeImagen({ x: 300, y: 300 });
await page.mouse.move(puntoZoom.x, puntoZoom.y);
for (let i = 0; i < 6; i++) {
  await page.mouse.wheel(0, -200); // deltaY negativo = acercar (ver alWheel)
  await page.waitForTimeout(50);
}
await page.waitForTimeout(150);
const boxAcercado = await circuloMarcador.boundingBox();
assert(boxAcercado.width > boxInicial.width, `El símbolo se agranda en pantalla al acercar (antes: ${boxInicial.width.toFixed(1)}px, después: ${boxAcercado.width.toFixed(1)}px)`);
assert(boxAcercado.width <= 48 + 1, `No supera el tope de presentación de 48px, incluso muy acercado (real: ${boxAcercado.width.toFixed(1)}px)`);

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await browser.close();
