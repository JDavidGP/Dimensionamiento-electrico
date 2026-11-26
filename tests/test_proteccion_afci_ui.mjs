// Protección AFCI por tipo de ambiente — usuario, 2026-11-26, "sigamos
// con AFCI" (NEC 210.12(B)). A diferencia de GFCI (por tomacorriente),
// AFCI protege el CIRCUITO completo — el checkbox vive en el circuito,
// y la advertencia dispara si CUALQUIERA de sus equipos cae en un
// ambiente de la lista. Prueba la UI real, mismo patrón que
// test_proteccion_gfci_ui.mjs.
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

// --- 1. Circuito con 2 equipos, sin AFCI marcado todavía ---
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Ej: Iluminación cocina").fill("Circuito AFCI");
await page.locator("label:has-text('Distancia (m)')").locator("..").locator("input").fill("5");
await page.getByRole("button", { name: "+ Crear circuito" }).click();
await page.waitForTimeout(200);

await page.getByPlaceholder("Ej: Refrigerador").fill("Lámpara dormitorio");
await page.locator("label:has-text('P unitaria (W)')").locator("..").locator("input").fill("60");
await page.getByRole("button", { name: "+ Agregar equipo" }).click();
await page.waitForTimeout(200);

await page.getByPlaceholder("Ej: Refrigerador").fill("Tomacorriente pasillo");
await page.locator("label:has-text('P unitaria (W)')").locator("..").locator("input").fill("100");
await page.getByRole("button", { name: "+ Agregar equipo" }).click();
await page.waitForTimeout(200);

// --- 2. Plano: calibrar + ambiente "Dormitorio 1" + colocar SOLO 1 de los 2 equipos ahí ---
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
await panelPlano.getByPlaceholder("Nombre (ej. Habitación #1)").fill("Dormitorio 1");
await panelPlano.getByPlaceholder("Ancho (m)").fill("2");
await panelPlano.getByPlaceholder("Largo (m)").fill("2");
await click({ x: 300, y: 300 });
await page.waitForTimeout(200);
const selectTipoAmbiente = panelPlano.locator("span", { hasText: "Tipo de ambiente:" }).locator("xpath=following-sibling::select[1]");
await selectTipoAmbiente.selectOption({ label: "Dormitorio" });
await page.waitForTimeout(150);

// Colocar "Lámpara dormitorio" DENTRO del ambiente ya tipeado.
await page.getByRole("button", { name: "Colocar equipo", exact: true }).click();
await page.waitForTimeout(150);
const selectEquipoYaIngresado = panelPlano.locator("select", { hasText: "¿Equipo ya ingresado?" });
await selectEquipoYaIngresado.selectOption({ label: await selectEquipoYaIngresado.locator("option").filter({ hasText: "Lámpara dormitorio" }).textContent() });
await click({ x: 300, y: 300 });
await page.waitForTimeout(200);

// El 2do equipo, FUERA de cualquier ambiente — por sí solo no dispara nada.
await selectEquipoYaIngresado.selectOption({ label: await selectEquipoYaIngresado.locator("option").filter({ hasText: "Tomacorriente pasillo" }).textContent() });
await click({ x: 480, y: 480 });
await page.waitForTimeout(200);

// --- 3. Avisa junto al marcador de la lámpara (la que SÍ está en el dormitorio) ---
assert((await panelPlano.getByText(/Su circuito requiere AFCI \(NEC 210\.12\(B\) — dormitorio\)/).count()) === 1, "Avisa junto al marcador del equipo que está en el dormitorio");

// --- 4. La misma advertencia aparece UNA VEZ en Circuitos y resultados (a nivel circuito, no por cada equipo) ---
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
await page.getByText("Circuito AFCI", { exact: false }).first().click();
await page.waitForTimeout(150);
assert((await page.getByText(/Requiere protección AFCI/).count()) === 1, "La advertencia de AFCI aparece UNA sola vez en Circuitos y resultados (a nivel circuito)");

// --- 5. Marcar 'Protegido por AFCI' en el circuito -> desaparece en los 2 lados ---
await page.getByRole("button", { name: "Editar circuito Circuito AFCI" }).click();
await page.waitForTimeout(200);
await page.getByText("Protegido por AFCI", { exact: true }).click();
await page.getByRole("button", { name: "Guardar cambios" }).click();
await page.waitForTimeout(200);
assert((await page.getByText(/Requiere protección AFCI/).count()) === 0, "Tras marcar 'Protegido por AFCI', la advertencia desaparece en Circuitos y resultados");

await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);
assert((await panelPlano.getByText(/requiere AFCI/).count()) === 0, "...y también desaparece junto al marcador en el Plano");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await browser.close();
