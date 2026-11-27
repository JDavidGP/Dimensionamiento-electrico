// ID del circuito junto a cada equipo real en el Plano — usuario,
// 2026-11-27, cerrando la discusión sobre qué símbolos merece ver un
// electricista: "en el plano solo se observará tomacorrientes, puntos
// de luces con sus interruptores y motores... el ID señala qué equipo
// o circuito se encuentra vinculado en ese tomacorriente... se trabaja
// más limpio, es sencillo y detalla lo necesario". Prueba la UI real:
// cada marcador de equipo (contacto/luminaria/motor) YA vinculado a un
// equipo real con circuito asignado muestra la etiqueta de ESE
// circuito bajo su símbolo; un interruptor conmutado la hereda de la
// luminaria que controla ("puntos de luces CON SUS interruptores");
// un interruptor suelto (sin vínculo posible) no muestra nada; el
// marcador "Circuito (PIA)" en sí tampoco (no es un equipo).
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

const panelPlano = page.locator('div[style*="grid-template-columns: 1fr 280px"]').first();
const svg = panelPlano.locator("svg").last();
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
  const box = await svg.boundingBox();
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

// --- 0. Un circuito real con 2 equipos (lámpara + tomacorriente) ---
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Ej: Iluminación cocina").fill("Circuito con ID");
await page.locator("label", { hasText: "Distancia (m)" }).locator("xpath=following-sibling::input[1]").fill("1");
const etiquetaSugerida = await page.locator("label", { hasText: "Etiqueta" }).locator("xpath=following-sibling::input[1]").inputValue();
await page.getByRole("button", { name: "+ Crear circuito" }).click();
await page.waitForTimeout(150);
await page.getByPlaceholder("Ej: Refrigerador").fill("Lámpara con ID");
await page.locator("label", { hasText: "P unitaria (W)" }).locator("xpath=following-sibling::input[1]").fill("15");
await page.getByRole("button", { name: "+ Agregar equipo" }).click();
await page.waitForTimeout(150);
await page.getByPlaceholder("Ej: Refrigerador").fill("Tomacorriente con ID");
await page.locator("label", { hasText: "P unitaria (W)" }).locator("xpath=following-sibling::input[1]").fill("180");
await page.getByRole("button", { name: "+ Agregar equipo" }).click();
await page.waitForTimeout(200);

// --- 1. Plano: calibrar, "Generar circuito" coloca los 2 equipos YA vinculados ---
await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);
await page.locator('input[type="file"][accept="image/*,application/pdf"]').setInputFiles(DIR + "fixtures/plano_test.png");
await page.waitForTimeout(400);

await panelPlano.getByRole("button", { name: "Calibrar", exact: true }).click();
await page.waitForTimeout(150);
await click({ x: 100, y: 100 });
await click({ x: 500, y: 100 });
await panelPlano.getByPlaceholder("Ej: 5").fill("5");
await panelPlano.getByRole("button", { name: "Calibrar", exact: true }).last().click();
await page.waitForTimeout(200);

await panelPlano.getByRole("button", { name: "Generar circuito", exact: true }).click();
await page.waitForTimeout(100);
const selectGenerarCircuito = panelPlano.locator("select").filter({ has: page.locator('option:has-text("¿Qué circuito?")') });
await selectGenerarCircuito.selectOption({ label: await selectGenerarCircuito.locator("option").filter({ hasText: "Circuito con ID" }).textContent() });
await click({ x: 150, y: 150 });
await page.waitForTimeout(250);

assert((await svg.getByText(etiquetaSugerida, { exact: true }).count()) === 2, `Los 2 equipos reales (lámpara + tomacorriente) muestran la etiqueta del circuito '${etiquetaSugerida}' bajo su símbolo (real: ${await svg.getByText(etiquetaSugerida, { exact: true }).count()})`);

// --- 2. Interruptor conmutado vinculado a la lámpara hereda la MISMA etiqueta ("puntos de luz CON SUS interruptores") ---
await panelPlano.getByRole("button", { name: "Colocar equipo", exact: true }).click();
await page.waitForTimeout(100);
const toolbarEquipo = panelPlano.locator("select", { hasText: "¿Equipo ya ingresado?" }).locator("xpath=..");
const selectTipo = toolbarEquipo.locator("select").nth(1);
const inputNombreToolbar = toolbarEquipo.locator('input[placeholder="Nombre (opcional)"]');

await selectTipo.selectOption("interruptor_conmutado");
await inputNombreToolbar.fill("Interruptor con ID");
await click({ x: 300, y: 300 });
await page.waitForTimeout(250);

const listaEquiposPlano = panelPlano.getByText(/^Equipos en el plano \(/).locator("xpath=following-sibling::div[1]");
const tarjetaInterruptor = listaEquiposPlano.locator('input[value="Interruptor con ID"]').locator("xpath=..");
const selectControla = tarjetaInterruptor.locator("select").last();
await selectControla.selectOption({ label: await selectControla.locator("option").filter({ hasText: "Lámpara con ID" }).textContent() });
await page.waitForTimeout(200);

assert((await svg.getByText(etiquetaSugerida, { exact: true }).count()) === 3, "El interruptor conmutado, vinculado a la lámpara, TAMBIÉN muestra la etiqueta del circuito (ya son 3 en el lienzo)");

// --- 3. Un interruptor SUELTO (no conmutado, sin vínculo posible) no muestra ninguna etiqueta ---
await selectTipo.selectOption("interruptor");
await inputNombreToolbar.fill("");
await click({ x: 500, y: 500 });
await page.waitForTimeout(200);
assert((await svg.getByText(etiquetaSugerida, { exact: true }).count()) === 3, "Un interruptor suelto (sin vínculo a ninguna luminaria) no suma una 4ta etiqueta — sigue en 3");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await browser.close();
