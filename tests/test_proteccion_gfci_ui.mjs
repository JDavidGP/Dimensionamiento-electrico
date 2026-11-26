// Protección GFCI por tipo de ambiente — usuario, 2026-11-25/26: "el
// tipo de tomacorriente incluso... el ambiente donde se localiza".
// Prueba la UI real: un tomacorriente dentro de un ambiente "Baño"
// (sin GFCI marcado) avisa en Circuitos y resultados Y junto a su
// marcador en el Plano (NEC 210.8(A)) — marcar "Protegido por GFCI" lo
// hace desaparecer en los dos lados. Verificado también que NO avisa
// bajo REBT (gateado a NEC/CIEN, ver advertenciasGFCI en useCircuitos.js).
import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1300 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto(process.env.BASE_URL || "http://localhost:4343", { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

// --- 1. Circuito + equipo tomacorriente, sin GFCI marcado todavía ---
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Ej: Iluminación cocina").fill("Circuito GFCI");
await page.locator("label:has-text('Distancia (m)')").locator("..").locator("input").fill("5");
await page.getByRole("button", { name: "+ Crear circuito" }).click();
await page.waitForTimeout(200);

await page.getByPlaceholder("Ej: Refrigerador").fill("Tomacorriente baño");
await page.locator("label:has-text('P unitaria (W)')").locator("..").locator("input").fill("100");
await page.getByRole("button", { name: "+ Agregar equipo" }).click();
await page.waitForTimeout(200);

// --- 2. Plano: calibrar + crear un ambiente "Baño 1" ---
await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);
await page.locator('input[type="file"][accept="image/*,application/pdf"]').setInputFiles(DIR + "fixtures/plano_test.png");
await page.waitForTimeout(400);

const panelPlano = page.locator('div[style*="grid-template-columns: 1fr 280px"]').first();
const svgPlano = panelPlano.locator("svg").last();
const REGEX_PAN_ZOOM = /translate\(([-\d.]+),([-\d.]+)\) scale\(([-\d.]+)\)/;
async function grupoPanZoomPlano() {
  const grupos = await panelPlano.locator("svg > g").all();
  for (const g of grupos) {
    const t = await g.getAttribute("transform");
    if (t && REGEX_PAN_ZOOM.test(t)) return g;
  }
  throw new Error("No se encontró el grupo de pan/zoom del Plano.");
}
async function puntoPantallaDesdeImagen(puntoImagen) {
  const grupo = await grupoPanZoomPlano();
  const box = await svgPlano.boundingBox();
  const t = await grupo.getAttribute("transform");
  const m = t.match(REGEX_PAN_ZOOM);
  const panX = parseFloat(m[1]), panY = parseFloat(m[2]), zoom = parseFloat(m[3]);
  return { x: box.x + puntoImagen.x * zoom + panX, y: box.y + puntoImagen.y * zoom + panY };
}
async function click(puntoImagen) {
  const p = await puntoPantallaDesdeImagen(puntoImagen);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(100);
}

await panelPlano.getByRole("button", { name: "Calibrar por perímetro", exact: true }).click();
await page.waitForTimeout(150);
await panelPlano.locator("label", { hasText: "Asistencia de bordes" }).locator('input[type="checkbox"]').uncheck();
await page.waitForTimeout(80);
for (const punto of [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 500 }, { x: 100, y: 500 }]) {
  await click(punto);
}
await panelPlano.getByPlaceholder("Ej: 60").fill("32"); // 1600px de perímetro -> 0.02 m/px
await panelPlano.getByRole("button", { name: "Calibrar", exact: true }).last().click();
await page.waitForTimeout(200);

await panelPlano.getByRole("button", { name: "Generar ambiente", exact: true }).click();
await page.waitForTimeout(150);
await panelPlano.getByPlaceholder("Nombre (ej. Habitación #1)").fill("Baño 1");
await panelPlano.getByPlaceholder("Ancho (m)").fill("2");
await panelPlano.getByPlaceholder("Largo (m)").fill("2");
await click({ x: 300, y: 300 });
await page.waitForTimeout(200);
assert((await panelPlano.getByText("Ambientes (1)").count()) === 1, "El ambiente 'Baño 1' quedó creado");

// Por default, tipo "Otro" -> sin requerimiento todavía.
await page.getByRole("button", { name: "Colocar equipo", exact: true }).click();
await page.waitForTimeout(150);
const selectEquipoYaIngresado = panelPlano.locator("select", { hasText: "¿Equipo ya ingresado?" });
await selectEquipoYaIngresado.selectOption({ label: await selectEquipoYaIngresado.locator("option").filter({ hasText: "Tomacorriente baño" }).textContent() });
await click({ x: 300, y: 300 });
await page.waitForTimeout(200);
assert((await panelPlano.getByText(/Requiere GFCI/).count()) === 0, "Ambiente todavía 'Otro' (default) -> sin advertencia de GFCI todavía");

// --- 3. Marcar el ambiente como "Baño" -> ahora SÍ exige GFCI ---
const selectTipoAmbiente = panelPlano.locator("span", { hasText: "Tipo de ambiente:" }).locator("xpath=following-sibling::select[1]");
await selectTipoAmbiente.selectOption({ label: "Baño" });
await page.waitForTimeout(150);
assert((await panelPlano.getByText(/Requiere GFCI \(NEC 210\.8\(A\) — baño\)/).count()) === 1, "Tras marcar el ambiente como 'Baño', avisa junto al marcador (NEC 210.8(A))");

// --- 4. La misma advertencia aparece en 'Circuitos y resultados' ---
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
await page.getByText("Circuito GFCI", { exact: false }).first().click();
await page.waitForTimeout(150);
assert((await page.getByText(/Requiere protección GFCI/).count()) === 1, "La misma advertencia aparece en Circuitos y resultados, junto al equipo");

// --- 5. Marcar 'Protegido por GFCI' -> desaparece en los 2 lados ---
await page.getByRole("button", { name: "Editar Tomacorriente baño" }).click();
await page.waitForTimeout(150);
await page.getByText("Protegido por GFCI", { exact: true }).click();
await page.getByRole("button", { name: "Guardar cambios" }).click();
await page.waitForTimeout(200);
assert((await page.getByText(/Requiere protección GFCI/).count()) === 0, "Tras marcar 'Protegido por GFCI', la advertencia desaparece en Circuitos y resultados");

await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);
assert((await panelPlano.getByText(/Requiere GFCI/).count()) === 0, "...y también desaparece junto al marcador en el Plano");

// --- 6. Bajo REBT (IEC_ES) no debería avisar nunca, aunque el equipo no tenga GFCI ---
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Editar Tomacorriente baño" }).click();
await page.waitForTimeout(150);
await page.getByText("Protegido por GFCI", { exact: true }).click(); // lo desmarca de nuevo
await page.getByRole("button", { name: "Guardar cambios" }).click();
await page.waitForTimeout(200);

await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "NEC ▾" }).click();
await page.getByRole("button", { name: "IEC", exact: true }).click();
await page.getByRole("button", { name: "Validar", exact: true }).click();
await page.waitForTimeout(200);
const botonContinuar = page.getByRole("button", { name: "Continuar y recalcular", exact: true });
if (await botonContinuar.count()) {
  await botonContinuar.click();
  await page.waitForTimeout(200);
}

await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);
assert((await panelPlano.getByText(/Requiere GFCI/).count()) === 0, "Bajo REBT (IEC_ES), nunca avisa de GFCI — gateado a NEC/CIEN, sin cita propia para REBT");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await browser.close();
