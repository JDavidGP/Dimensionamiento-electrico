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

// =========== PARTE 1: corrección de perspectiva ===========
await page.locator('input[type="file"][accept="image/*,application/pdf"]').setInputFiles(
  DIR + "fixtures/plano_test.png" // 800x600
);
await page.waitForTimeout(400);

await page.getByRole("button", { name: "Corregir perspectiva", exact: true }).click();
await page.waitForTimeout(150);

// 4 esquinas DISTORSIONADAS (no forman un rectángulo) dentro de la
// imagen de 800x600 -> deberían representar un rectángulo real de 4x3m.
const esquinasDistorsionadas = [
  { x: 150, y: 100 },
  { x: 650, y: 140 },
  { x: 600, y: 520 },
  { x: 180, y: 500 },
];
for (const esquina of esquinasDistorsionadas) {
  const p = await puntoPantallaDesdeImagen(esquina);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(100);
}
await page.waitForTimeout(200);

assert((await page.getByPlaceholder("Ej: 4").count()) === 1, "Tras los 4 puntos, aparece el formulario de ancho/alto real");
await page.getByPlaceholder("Ej: 4").fill("4");
await page.getByPlaceholder("Ej: 3").fill("3");
await page.getByRole("button", { name: "Corregir perspectiva", exact: true }).last().click();
await page.waitForTimeout(600);

assert((await page.getByText(/Perspectiva corregida/).count()) === 1, "Aviso de confirmación tras corregir la perspectiva");

// La imagen rectificada debería ser EXACTAMENTE 4m×3m a 120px/m = 480×360px.
const anchoImg = await page.locator("svg > g image").last().getAttribute("width");
const altoImg = await page.locator("svg > g image").last().getAttribute("height");
assert(anchoImg === "480" && altoImg === "360", `La imagen rectificada mide 4m×120 = 480px, 3m×120 = 360px (real: ${anchoImg}x${altoImg})`);

// La calibración debería haber quedado AUTOMÁTICA (1/120 m/px).
const textoCalibrado = await page.getByText(/Calibrado:/).textContent();
assert(/0\.00833 m\/px/.test(textoCalibrado), `La calibración quedó automática en 1/120 = 0.00833 m/px (real: '${textoCalibrado}')`);

// Trazar el rectángulo COMPLETO de la imagen ya rectificada (sus 4
// esquinas en espacio imagen: (0,0)-(480,0)-(480,360)-(0,360)) y
// verificar que el área/perímetro salgan EXACTOS a 4m x 3m — la
// prueba definitiva de que deskewing + autocalibración son correctos.
await page.getByRole("button", { name: "Trazar pared", exact: true }).click();
await page.waitForTimeout(150);
const checkboxAsistencia = page.locator("label", { hasText: "Asistencia de bordes" }).locator('input[type="checkbox"]');
await checkboxAsistencia.uncheck(); // la imagen de prueba no tiene bordes reales -> evitar que "ajuste" el click a cualquier cosa

page.once("dialog", (d) => d.accept("Habitación rectificada"));
const esquinasRectificado = [
  { x: 2, y: 2 },
  { x: 478, y: 2 },
  { x: 478, y: 358 },
  { x: 2, y: 358 },
  { x: 2, y: 2 },
];
for (const esquina of esquinasRectificado) {
  const p = await puntoPantallaDesdeImagen(esquina);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(120);
}
await page.waitForTimeout(300);

const textoArea = await page.locator("div", { hasText: /m² · perímetro/ }).last().textContent();
const matchArea = textoArea.match(/([\d.]+) m² · perímetro ([\d.]+) m/);
const areaNum = parseFloat(matchArea[1]);
const perimNum = parseFloat(matchArea[2]);
// Tolerancia: los clicks de prueba se insertaron 2px adentro de cada
// esquina real (para evitar quedar justo en el borde del SVG), lo que
// de por sí resta ~2% del área esperada — no es imprecisión del cálculo.
assert(Math.abs(areaNum - 12) < 0.35, `Área del ambiente trazado sobre la imagen YA RECTIFICADA ≈ 4m×3m = 12 m² (real: ${areaNum}) — confirma que deskewing+autocalibración dan la medida real correcta`);
assert(Math.abs(perimNum - 14) < 0.35, `Perímetro ≈ 2×(4+3) = 14 m (real: ${perimNum})`);

console.log("\nErrores de página tras corrección de perspectiva:", errores);
assert(errores.length === 0, "Sin errores de página en el flujo de perspectiva");

await page.screenshot({ path: DIR + "tmp/plano_perspectiva.png", fullPage: true });

// =========== PARTE 2: exportación DXF ===========
const [descargaDXF] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: /Exportar DXF/, exact: false }).click(),
]);
const rutaDXF = DIR + "tmp/plano_export.dxf";
await descargaDXF.saveAs(rutaDXF);
assert(true, "El botón 'Exportar DXF' dispara una descarga de archivo .dxf");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await browser.close();
