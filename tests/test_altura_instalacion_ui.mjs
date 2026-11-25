// Altura de instalación del equipo sumada al metraje real + aviso de
// desincronización — usuario, 2026-11-25: "hay que tomar en cuenta la
// altura donde se instala un interruptor [o] tomacorriente" y "¿cómo
// está validado ese dato?" (la Distancia escrita a mano vs. la ruta
// trazada en el Plano). Prueba la UI real de punta a punta, sobre el
// mismo patrón de calibración que test_plano_autocompletar_distancia_ui.mjs.
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

// --- 1. Circuito + equipo con altura de instalación cargada (0.4m, referencia "techo" por default) ---
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Ej: Iluminación cocina").fill("Circuito altura");
await page.locator("label:has-text('Distancia (m)')").locator("..").locator("input").fill("1");
await page.getByRole("button", { name: "+ Crear circuito" }).click();
await page.waitForTimeout(200);

await page.getByPlaceholder("Ej: Refrigerador").fill("Tomacorriente prueba");
await page.locator("label:has-text('P unitaria (W)')").locator("..").locator("input").fill("150");
await page.getByPlaceholder("Ej: 0.4").fill("0.4");
await page.getByRole("button", { name: "+ Agregar equipo" }).click();
await page.waitForTimeout(200);

// --- 2. Plano: calibrar (mismo patrón que test_plano_autocompletar_distancia_ui.mjs: 0.02 m/px) + altura de techo general ---
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

await panelPlano.locator("input[placeholder='Ej: 2.4']").fill("2.5"); // altura de techo general
await page.waitForTimeout(150);

// --- 3. Colocar el marcador del tomacorriente YA vinculado, en el punto donde va a terminar la ruta ---
await panelPlano.getByRole("button", { name: "Colocar equipo", exact: true }).click();
await page.waitForTimeout(150);
const selectEquipoYaIngresado = panelPlano.locator("select", { hasText: "¿Equipo ya ingresado?" });
await selectEquipoYaIngresado.selectOption({ label: await selectEquipoYaIngresado.locator("option").filter({ hasText: "Tomacorriente prueba" }).textContent() });
await click({ x: 350, y: 300 });
await page.waitForTimeout(200);
assert((await panelPlano.getByText("Equipos en el plano (1)").count()) === 1, "El marcador del tomacorriente quedó colocado y vinculado");

// --- 4. Trazar un conductor recto de 5m terminando justo en ese punto ---
await panelPlano.getByRole("button", { name: "Trazar conductor", exact: true }).click();
await page.waitForTimeout(100);
await click({ x: 100, y: 300 });
await click({ x: 350, y: 300 });
await panelPlano.getByRole("button", { name: /Terminar ruta/ }).click();
await page.waitForTimeout(200);

// Sin cruces de pared: trazado ~5m + bajada (2.5m techo - 0.4m instalación = 2.1m) = ~7.1m total.
const textoRuta = await panelPlano.getByText(/longitud trazada/).textContent();
assert(/longitud trazada 4\.9\d m/.test(textoRuta), `Ruta trazada ≈5m (real: '${textoRuta}')`);
assert(/bajando desde el techo al equipo/.test(textoRuta), `Muestra el extra de bajada desde el techo (real: '${textoRuta}')`);
assert(/total 7\.0\d m/.test(textoRuta), `Total = trazado + bajada ≈7.0-7.1m (real: '${textoRuta}')`);

// --- 5. Vincular al circuito y "Usar esta longitud" ---
await panelPlano.locator("select").filter({ hasText: "Vincular a" }).selectOption({ label: "Circuito altura" });
await page.waitForTimeout(150);
assert(await panelPlano.getByText(/Usar esta longitud \(7\.0\d m\)/).isVisible(), "El botón 'Usar esta longitud' ya muestra el total CON la altura incluida, no solo el trazado");
await panelPlano.getByRole("button", { name: /Usar esta longitud/ }).click();
await page.waitForTimeout(200);

await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
assert((await page.getByText(/Distancia \(.*desincronizada/).count()) === 0, "Recién aplicado, no hay ninguna advertencia de desincronización");
await page.getByRole("button", { name: "Editar circuito Circuito altura" }).click();
await page.waitForTimeout(200);
const valorDistancia = await page.locator("label:has-text('Distancia (m)')").locator("..").locator("input").inputValue();
assert(Math.abs(parseFloat(valorDistancia) - 7.1) < 0.15, `El campo Distancia (m) real quedó en ~7.1 (trazado + bajada), no solo ~5m (real: '${valorDistancia}')`);
await page.getByRole("button", { name: "Cancelar" }).click();

// --- 6. Editar la distancia a mano, a un valor distinto -> aparece la advertencia de desincronización ---
await page.getByRole("button", { name: "Editar circuito Circuito altura" }).click();
await page.waitForTimeout(200);
await page.locator("label:has-text('Distancia (m)')").locator("..").locator("input").fill("1");
await page.getByRole("button", { name: "Guardar cambios" }).click();
await page.waitForTimeout(200);

await page.getByText("Circuito altura", { exact: false }).first().click(); // expandir el acordeón del circuito
await page.waitForTimeout(150);
assert((await page.getByText(/Distancia \(1\.00m\) desincronizada de la ruta/).count()) === 1, "Tras editar la distancia a mano, aparece la advertencia de desincronización con el plano");

// --- 7. Re-sincronizar desde el Plano -> la advertencia desaparece sola ---
await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);
await panelPlano.getByRole("button", { name: /Usar esta longitud/ }).click();
await page.waitForTimeout(200);

await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
assert((await page.getByText(/desincronizada de la ruta/).count()) === 0, "Tras volver a aplicar 'Usar esta longitud', la advertencia de desincronización desaparece sola");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await browser.close();
