// Volúmenes de seguridad del baño — REBT ITC-BT-27 (usuario,
// 2026-11-26, "sigamos" tras confirmar la Tabla 1 exacta en el texto
// consolidado del BOE). Prueba la UI real: un marcador "Fuente de
// agua" + un tomacorriente a distintas distancias — prohibido cerca
// (Volumen 0/1/2), permitido con diferencial ≤30mA un poco más lejos
// (Volumen 3), sin restricción bien lejos.
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

// --- 0. Normativa IEC_ES (REBT) — el concepto es exclusivo de esta normativa ---
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

// --- 1. Circuito + equipo tomacorriente ---
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Ej: Iluminación cocina").fill("Circuito baño");
await page.locator("label:has-text('Distancia (m)')").locator("..").locator("input").fill("5");
await page.getByRole("button", { name: "+ Crear circuito" }).click();
await page.waitForTimeout(200);

await page.getByPlaceholder("Ej: Refrigerador").fill("Tomacorriente cerca de bañera");
await page.locator("label:has-text('P unitaria (W)')").locator("..").locator("input").fill("100");
await page.getByRole("button", { name: "+ Agregar equipo" }).click();
await page.waitForTimeout(200);

// --- 2. Plano: calibrar (0.02 m/px) ---
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
await panelPlano.getByPlaceholder("Ej: 60").fill("32"); // 1600px de perímetro -> 0.02 m/px (1m = 50px)
await panelPlano.getByRole("button", { name: "Calibrar", exact: true }).last().click();
await page.waitForTimeout(200);

// --- 3. Colocar "Fuente de agua" en (200,200) ---
await panelPlano.getByRole("button", { name: "Colocar equipo", exact: true }).click();
await page.waitForTimeout(150);
const selectTipo = panelPlano.locator("select").nth(1); // 2do select de la barra ("¿Equipo ya ingresado?" es el 1ro)
await selectTipo.selectOption("fuente_agua");
await page.waitForTimeout(100);
await click({ x: 200, y: 200 });
await page.waitForTimeout(200);
assert((await panelPlano.getByText("Equipos en el plano (1)").count()) === 1, "La fuente de agua quedó colocada");

// --- 4. Colocar el tomacorriente a 0.3m (15px) -> dentro de Volumen 0/1/2 (límite 1.2m con el radio default 0.6m) -> PROHIBIDO ---
await selectTipo.selectOption("contacto");
await page.waitForTimeout(100);
const selectEquipoYaIngresado = panelPlano.locator("select", { hasText: "¿Equipo ya ingresado?" });
await selectEquipoYaIngresado.selectOption({ label: await selectEquipoYaIngresado.locator("option").filter({ hasText: "Tomacorriente cerca de bañera" }).textContent() });
await click({ x: 200, y: 215 }); // 15px = 0.3m
await page.waitForTimeout(200);

assert((await panelPlano.getByText(/Prohibido por ITC-BT-27/).count()) === 1, "A 0.3m de la fuente de agua (dentro de Volumen 0/1/2) -> PROHIBIDO");

// --- 5. Moverlo a 2m (100px) -> Volumen 3 (límite 3.6m) -> permitido, pero exige diferencial ≤30mA (todavía sin asignar) ---
await panelPlano.getByRole("button", { name: "Mover equipo", exact: true }).click();
await page.waitForTimeout(150);
let desde = await puntoPantallaDesdeImagen({ x: 200, y: 215 });
let hasta = await puntoPantallaDesdeImagen({ x: 200, y: 300 }); // (300-200)=100px=2m desde la fuente
await page.mouse.move(desde.x, desde.y);
await page.mouse.down();
await page.mouse.move((desde.x + hasta.x) / 2, (desde.y + hasta.y) / 2, { steps: 5 });
await page.mouse.move(hasta.x, hasta.y, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(250);

assert((await panelPlano.getByText(/Prohibido por ITC-BT-27/).count()) === 0, "A 2m, ya no cae en Volumen 0/1/2 -> deja de ser prohibido");
assert((await panelPlano.getByText(/Volumen 3.*sin diferencial/).count()) === 1, "A 2m (Volumen 3), avisa que falta un diferencial ≤30mA — todavía permitido, no prohibido");

// --- 6. Crear un Diferencial de 30mA y asignarle el circuito -> la advertencia de Volumen 3 desaparece ---
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(250);
await page.getByRole("button", { name: "+ Nuevo diferencial" }).click();
await page.getByPlaceholder("Ej: ID planta baja").fill("ID baño");
await page.getByRole("button", { name: "+ Crear diferencial" }).click();
await page.waitForTimeout(200);

await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
await page.getByLabel("Diferencial de Circuito baño").selectOption({ label: "ID baño" });
await page.waitForTimeout(150);

await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);
assert((await panelPlano.getByText(/Volumen 3/).count()) === 0, "Tras asignar un diferencial de 30mA al circuito, la advertencia de Volumen 3 desaparece");

// --- 7. Moverlo bien lejos (6m) -> fuera de todo volumen, sin ninguna advertencia ---
await panelPlano.getByRole("button", { name: "Mover equipo", exact: true }).click();
await page.waitForTimeout(150);
desde = await puntoPantallaDesdeImagen({ x: 200, y: 300 });
hasta = await puntoPantallaDesdeImagen({ x: 200, y: 500 }); // (500-200)=300px=6m desde la fuente
await page.mouse.move(desde.x, desde.y);
await page.mouse.down();
await page.mouse.move((desde.x + hasta.x) / 2, (desde.y + hasta.y) / 2, { steps: 5 });
await page.mouse.move(hasta.x, hasta.y, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(250);
assert((await panelPlano.getByText(/ITC-BT-27/).count()) === 0, "A 6m de la fuente de agua, bien fuera de todo volumen -> sin ninguna advertencia");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await browser.close();
