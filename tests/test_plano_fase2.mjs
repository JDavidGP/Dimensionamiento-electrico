import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4352"), { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

async function puntoPantallaDesdeImagen(puntoImagen) {
  const svg = page.locator("svg").last();
  const box = await svg.boundingBox();
  const transformAttr = await page.locator("svg > g").last().getAttribute("transform");
  const m = transformAttr.match(/translate\(([-\d.]+),([-\d.]+)\) scale\(([-\d.]+)\)/);
  const panX = parseFloat(m[1]), panY = parseFloat(m[2]), zoom = parseFloat(m[3]);
  return { x: box.x + puntoImagen.x * zoom + panX, y: box.y + puntoImagen.y * zoom + panY, zoom };
}

await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);

// =========== PARTE 1: soporte de PDF ===========
await page.locator('input[type="file"][accept="image/*,application/pdf"]').setInputFiles(
  DIR + "fixtures/plano_test.pdf"
);
await page.waitForTimeout(1500); // pdf.js carga de forma dinámica (chunk aparte) + renderiza

assert((await page.getByText("Cargá un plano para empezar.").count()) === 0, "El PDF se cargó y renderizó como plano de fondo");

// Página de 8x6 pulgadas (576x432 pt) a 150 DPI de referencia -> 1200x900 px exactos.
const box1 = await page.locator("svg > g image").last().getAttribute("width");
const box2 = await page.locator("svg > g image").last().getAttribute("height");
assert(box1 === "1200" && box2 === "900", `El PDF se rasterizó a 150 DPI de referencia: 8in×150=1200, 6in×150=900 (real: ${box1}x${box2})`);

console.log("\nErrores de página tras cargar PDF:", errores);
assert(errores.length === 0, "Sin errores de página al cargar un PDF");

// =========== PARTE 2: asistencia de bordes ===========
await page.locator('input[type="file"][accept="image/*,application/pdf"]').setInputFiles(
  DIR + "fixtures/plano_borde.png"
);
await page.waitForTimeout(500);

// Calibrar (cualquier escala sirve para esta prueba — lo que importa es el snap en espacio IMAGEN)
await page.getByRole("button", { name: "Calibrar", exact: true }).click();
await page.waitForTimeout(150);
let p = await puntoPantallaDesdeImagen({ x: 100, y: 100 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(80);
p = await puntoPantallaDesdeImagen({ x: 500, y: 100 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(150);
await page.getByPlaceholder("Ej: 5").fill("4");
await page.getByRole("button", { name: "Calibrar", exact: true }).last().click();
await page.waitForTimeout(200);

await page.getByRole("button", { name: "Trazar pared", exact: true }).click();
await page.waitForTimeout(150);
assert((await page.getByText(/Asistencia de bordes/).count()) === 1, "Aparece el toggle de asistencia de bordes en modo Trazar pared");
const checkboxAsistencia = page.locator("label", { hasText: "Asistencia de bordes" }).locator('input[type="checkbox"]');
assert(await checkboxAsistencia.isChecked(), "La asistencia de bordes está activa por defecto");

// La imagen de prueba tiene un borde vertical NÍTIDO en x=400 (gris oscuro | gris claro).
// Clickeamos 6px a la IZQUIERDA del borde real -> debería "pegarse" a x=400 exacto.
async function nodosActualesXML() {
  return page.locator("svg > g circle").last().getAttribute("cx");
}

const puntoCercaDelBorde = { x: 394, y: 300 }; // 6px del borde real (400)
const pBorde = await puntoPantallaDesdeImagen(puntoCercaDelBorde);
await page.mouse.click(pBorde.x, pBorde.y);
await page.waitForTimeout(200);

// Leemos el nodo recién creado: su cx en espacio imagen (antes de escala) debería
// rondar 400 (el borde real), no 394 (el click original).
const cxCreado = parseFloat(await page.locator("svg > g circle").last().getAttribute("cx"));
assert(Math.abs(cxCreado - 400) <= 2, `Con asistencia de bordes activa, el click en x=394 se pega al borde real en x≈400 (real: x=${cxCreado})`);

// --- Ahora con la asistencia DESACTIVADA, el mismo click no debería ajustarse ---
await page.getByRole("button", { name: "Terminar este trazo sin cerrar", exact: true }).click().catch(() => {});
await checkboxAsistencia.uncheck();
await page.waitForTimeout(100);
const puntoLejosDelBorde = { x: 200, y: 450 }; // bien lejos de x=400, para no "pegarse" a nada
const pLejos = await puntoPantallaDesdeImagen(puntoLejosDelBorde);
await page.mouse.click(pLejos.x, pLejos.y);
await page.waitForTimeout(200);
const cxSinAsistencia = parseFloat(await page.locator("svg > g circle").last().getAttribute("cx"));
assert(Math.abs(cxSinAsistencia - 200) <= 1, `Con la asistencia desactivada, el click no se ajusta (real: x=${cxSinAsistencia}, esperado ≈200)`);

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/plano_fase2.png", fullPage: true });
await browser.close();
