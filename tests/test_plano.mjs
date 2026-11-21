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

// Diagrama unifilar y Plano ahora viven agrupados bajo la pestaña
// "Esquemas" (sub-pestañas, ver SubTabs.jsx) — pedido explícito del
// usuario (2026-11-20): agruparlos sin fusionar sus lienzos.
await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);

assert((await page.getByText("Cargá un plano para empezar.").count()) === 1, "Estado vacío del plano");

// --- 1. Cargar imagen ---
await page.locator('input[type="file"][accept="image/*,application/pdf"]').setInputFiles(
  DIR + "fixtures/plano_test.png"
);
await page.waitForTimeout(400);
assert((await page.getByText("Cargá un plano para empezar.").count()) === 0, "La imagen se cargó, desaparece el estado vacío");
assert((await page.getByRole("button", { name: "Mover vista", exact: true }).count()) === 1, "Aparecen los modos (Mover/Calibrar/Pared/Borrar)");

// Helper: lee el transform actual del <g> y convierte un punto de
// IMAGEN (píxeles del archivo) a coordenadas de PANTALLA absolutas
// (viewport), para poder clickear con precisión.
async function puntoPantallaDesdeImagen(puntoImagen) {
  const svg = page.locator("svg").last();
  const box = await svg.boundingBox();
  const transformAttr = await page.locator("svg > g").last().getAttribute("transform");
  const m = transformAttr.match(/translate\(([-\d.]+),([-\d.]+)\) scale\(([-\d.]+)\)/);
  const panX = parseFloat(m[1]), panY = parseFloat(m[2]), zoom = parseFloat(m[3]);
  return {
    x: box.x + puntoImagen.x * zoom + panX,
    y: box.y + puntoImagen.y * zoom + panY,
    zoom,
  };
}

// --- 2. Calibrar: 400px de imagen (horizontal) = 5 metros reales ---
await page.getByRole("button", { name: "Calibrar", exact: true }).click();
await page.waitForTimeout(150);

const pA = await puntoPantallaDesdeImagen({ x: 100, y: 100 });
await page.mouse.click(pA.x, pA.y);
await page.waitForTimeout(100);
const pB = await puntoPantallaDesdeImagen({ x: 500, y: 100 });
await page.mouse.click(pB.x, pB.y);
await page.waitForTimeout(150);

assert((await page.getByPlaceholder("Ej: 5").count()) === 1, "Aparece el campo de distancia real tras el 2do click");
await page.getByPlaceholder("Ej: 5").fill("5");
await page.getByRole("button", { name: "Calibrar", exact: true }).last().click();
await page.waitForTimeout(200);

const textoCalibrado1 = await page.getByText(/Calibrado: 5m/).textContent();
// Tolerancia: el click simulado solo tiene precisión de 1 CSS pixel
// entero, así que a cierto zoom el valor puede variar en el último
// decimal — no es imprecisión de la app, es del mouse simulado.
assert(/0\.0125\d m\/px/.test(textoCalibrado1), `La escala calculada es ~5/400 = 0.0125 m/px (real: '${textoCalibrado1}')`);

// --- 3. Zoom NO debe alterar la calibración mostrada ---
// .last(): Diagrama unifilar (sub-pestaña anterior a Plano, ver
// App.jsx) ahora también tiene sus propios botones de zoom "+"/"−" —
// el de Plano queda último en el DOM.
for (let i = 0; i < 4; i++) {
  await page.getByRole("button", { name: "+", exact: true }).last().click();
  await page.waitForTimeout(80);
}
const textoCalibradoTrasZoom = await page.getByText(/Calibrado: 5m/).textContent();
assert(textoCalibradoTrasZoom === textoCalibrado1, "Tras hacer zoom varias veces, la calibración mostrada NO cambia");

// Volver a "ajustar a ventana" antes de trazar (si no, parte del
// rectángulo de prueba queda fuera del área visible tras el zoom-in).
await page.getByRole("button", { name: "Ajustar", exact: true }).click();
await page.waitForTimeout(150);

// --- 4. Trazar un rectángulo de 400x300 px de imagen = 5m x 3.75m reales, cerrarlo ---
await page.getByRole("button", { name: "Trazar pared", exact: true }).click();
await page.waitForTimeout(150);

page.once("dialog", (d) => d.accept("Sala de prueba"));
const esquinas = [
  { x: 100, y: 100 },
  { x: 500, y: 100 },
  { x: 500, y: 400 },
  { x: 100, y: 400 },
  { x: 100, y: 100 }, // vuelve al inicio -> cierra
];
for (const esquina of esquinas) {
  const p = await puntoPantallaDesdeImagen(esquina);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(150);
}
await page.waitForTimeout(300);

// El Directorio (pestaña nueva, siguiente ronda) ahora TAMBIÉN
// muestra "Ambientes (N)" en su propia sub-sección — TabsViewPager
// mantiene las dos pestañas montadas a la vez. Acotamos a la propia
// caja de PlanoInteligente.jsx ("Plano inteligente" es un texto único
// de ESE panel, Directorio nunca lo repite) para no chocar con esa
// coincidencia.
const panelPlano = page.getByText("Plano inteligente", { exact: true }).locator("xpath=../../..");
assert((await panelPlano.getByText("Ambientes (1)").count()) === 1, "Se registró 1 ambiente al cerrar el trazo");
assert((await panelPlano.locator('input[value="Sala de prueba"]').count()) === 1, "El nombre ingresado en el prompt se usó para el ambiente");

const textoArea = await page.locator("div", { hasText: /m² · perímetro/ }).last().textContent();
const matchArea = textoArea.match(/([\d.]+) m² · perímetro ([\d.]+) m/);
const areaNum = parseFloat(matchArea[1]);
const perimNum = parseFloat(matchArea[2]);
assert(Math.abs(areaNum - 18.75) < 0.05, `Área calculada ≈ 5m × 3.75m = 18.75 m² (real: ${areaNum})`);
assert(Math.abs(perimNum - 17.5) < 0.05, `Perímetro calculado ≈ 2×(5+3.75) = 17.50 m (real: ${perimNum})`);

// --- 5. Guardar y volver a abrir el proyecto — la calibración/medidas no deben cambiar ---
const [descarga] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "↓ Guardar (.pdf)" }).click(),
]);
const rutaDescargada = DIR + "tmp/plano_proyecto.pdf";
await descarga.saveAs(rutaDescargada);
await page.waitForTimeout(200);

await page.reload({ waitUntil: "networkidle" });
await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(200);
assert((await page.getByText("Cargá un plano para empezar.").count()) === 1, "Tras recargar la página (proyecto nuevo), el plano vuelve a estar vacío");

await page.locator("label", { hasText: "Abrir" }).locator('input[type="file"]').setInputFiles(rutaDescargada);
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);

assert((await page.getByText("Cargá un plano para empezar.").count()) === 0, "Tras abrir el proyecto guardado, el plano (imagen) se restaura");
assert((await panelPlano.getByText("Ambientes (1)").count()) === 1, "El ambiente guardado se restaura al reabrir el proyecto");
const textoAreaTrasReabrir = await page.locator("div", { hasText: /m² · perímetro/ }).last().textContent();
assert(textoAreaTrasReabrir === textoArea, `El área/perímetro es IDÉNTICO tras guardar y reabrir (antes: '${textoArea}', después: '${textoAreaTrasReabrir}')`);
const textoCalibradoTrasReabrir = await page.getByText(/Calibrado: 5m/).textContent();
assert(textoCalibradoTrasReabrir === textoCalibrado1, "La calibración es idéntica tras guardar y reabrir el proyecto");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/plano.png", fullPage: true });
await browser.close();
