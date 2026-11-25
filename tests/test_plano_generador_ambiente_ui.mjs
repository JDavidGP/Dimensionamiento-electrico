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

// Diagrama unifilar y Plano viven agrupados bajo "Esquemas" (ver SubTabs.jsx).
await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);
const panelPlano = page.getByText("Plano inteligente", { exact: true }).locator("xpath=../../..");

// --- 1. Cargar y calibrar: 400px de imagen = 5 metros reales (0.0125 m/px) ---
await page.locator('input[type="file"][accept="image/*,application/pdf"]').setInputFiles(
  DIR + "fixtures/plano_test.png"
);
await page.waitForTimeout(400);
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

// --- 2. Generar un ambiente de 10m x 6m (= 60 m², perímetro 32m) con un click ---
await page.getByRole("button", { name: "Generar ambiente", exact: true }).click();
await page.waitForTimeout(150);
await page.getByPlaceholder("Nombre (ej. Habitación #1)").fill("Habitación #1");
await page.getByPlaceholder("Ancho (m)").fill("10");
await page.getByPlaceholder("Largo (m)").fill("6");

const centroImagen = { x: 400, y: 300 }; // bien adentro del lienzo de 1200x900 cargado
const pCentro = await puntoPantallaDesdeImagen(centroImagen);
await page.mouse.click(pCentro.x, pCentro.y);
await page.waitForTimeout(250);

assert((await panelPlano.getByText("Ambientes (1)").count()) === 1, "Se generó 1 ambiente con un solo click");
assert((await panelPlano.locator('input[value="Habitación #1"]').count()) >= 1, "El ambiente generado toma el nombre pedido");
const textoArea1 = await panelPlano.locator("div", { hasText: /m² · perímetro/ }).last().textContent();
const match1 = textoArea1.match(/([\d.]+) m² · perímetro ([\d.]+) m/);
assert(Math.abs(parseFloat(match1[1]) - 60) < 0.01, `Área EXACTA 10m×6m = 60 m² (real: ${match1[1]})`);
assert(Math.abs(parseFloat(match1[2]) - 32) < 0.01, `Perímetro EXACTO 2×(10+6)=32 m (real: ${match1[2]})`);

// El ambiente generado debe quedar CENTRADO en el punto clickeado — el
// nodo de la esquina superior-izquierda debería estar a medio ancho/
// alto (5m, 3m = 400px, 240px de imagen a esta escala) de distancia.
const cxEsperadoAprox = centroImagen.x - 400; // 400px de imagen = 5m a esta escala (0.0125 m/px)
const circulos = await page.locator("svg > g circle").evaluateAll((els) =>
  els.map((e) => ({ cx: parseFloat(e.getAttribute("cx")), cy: parseFloat(e.getAttribute("cy")) }))
);
const hayEsquinaCercana = circulos.some((c) => Math.abs(c.cx - cxEsperadoAprox) < 3);
assert(hayEsquinaCercana, `El ambiente quedó centrado en el punto clickeado (se esperaba una esquina cerca de x≈${cxEsperadoAprox})`);

// --- 3. Arrastrar el ambiente con "Mover ambiente" — debe trasladarse sin cambiar su forma/medida ---
await page.getByRole("button", { name: "Mover ambiente", exact: true }).click();
await page.waitForTimeout(150);

const nodoAntes = circulos.find((c) => Math.abs(c.cx - cxEsperadoAprox) < 3);
const pDesde = await puntoPantallaDesdeImagen(centroImagen); // arrastrar desde un punto DENTRO del rectángulo (su centro)
const pHasta = { x: pDesde.x + 120, y: pDesde.y + 60 }; // arrastre en pantalla, bien lejos del punto de origen

await page.mouse.move(pDesde.x, pDesde.y);
await page.mouse.down();
await page.mouse.move(pDesde.x + 40, pDesde.y + 20, { steps: 5 });
await page.mouse.move(pHasta.x, pHasta.y, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(250);

const circulosTrasArrastre = await page.locator("svg > g circle").evaluateAll((els) =>
  els.map((e) => ({ cx: parseFloat(e.getAttribute("cx")), cy: parseFloat(e.getAttribute("cy")) }))
);
const mismaEsquinaSigueAhi = circulosTrasArrastre.some((c) => Math.abs(c.cx - cxEsperadoAprox) < 3 && Math.abs(c.cy - (300 - 240)) < 3);
assert(!mismaEsquinaSigueAhi, "Tras arrastrar, el ambiente YA NO está en su posición original (se movió)");

const textoAreaTrasArrastre = await panelPlano.locator("div", { hasText: /m² · perímetro/ }).last().textContent();
assert(textoAreaTrasArrastre === textoArea1, `El área/perímetro NO cambian al arrastrar — sigue siendo una traslación rígida (antes: '${textoArea1}', después: '${textoAreaTrasArrastre}')`);

// --- 4. Arrastrar desde un punto FUERA de cualquier ambiente no debe mover nada ---
const pVacio = await puntoPantallaDesdeImagen({ x: 50, y: 700 }); // lejos de cualquier ambiente
await page.mouse.move(pVacio.x, pVacio.y);
await page.mouse.down();
await page.mouse.move(pVacio.x + 100, pVacio.y + 100, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(200);
const textoAreaTrasClickVacio = await panelPlano.locator("div", { hasText: /m² · perímetro/ }).last().textContent();
assert(textoAreaTrasClickVacio === textoArea1, "Arrastrar desde un punto FUERA de cualquier ambiente no mueve nada");

// --- 5. Persistencia: guardar y reabrir conserva el ambiente generado+movido ---
const [descarga] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "↓ Guardar (.pdf)" }).click(),
]);
const rutaDescargada = DIR + "tmp/plano_generador_ambiente.pdf";
await descarga.saveAs(rutaDescargada);
await page.waitForTimeout(200);

await page.reload({ waitUntil: "networkidle" });
await page.locator("label", { hasText: "Abrir" }).locator('input[type="file"]').setInputFiles(rutaDescargada);
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);

const panelPlanoTrasReabrir = page.getByText("Plano inteligente", { exact: true }).locator("xpath=../../..");
assert((await panelPlanoTrasReabrir.getByText("Ambientes (1)").count()) === 1, "El ambiente generado+movido persiste tras guardar y reabrir");
const textoAreaTrasReabrir = await panelPlanoTrasReabrir.locator("div", { hasText: /m² · perímetro/ }).last().textContent();
assert(textoAreaTrasReabrir === textoArea1, `El área/perímetro siguen siendo idénticos tras reabrir (real: '${textoAreaTrasReabrir}')`);

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/plano_generador_ambiente.png", fullPage: true });
await browser.close();
