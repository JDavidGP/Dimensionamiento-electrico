// "Sugerir ruta automática" — usuario, 2026-11-25, pensado como una
// instalación real: calibrar → ubicar tablero/equipos → trazar la red
// de conductores permitida → el resto se conecta solo. Verifica en
// vivo que, dada una red de conductores YA trazada a mano, el sistema
// encuentra el camino más corto desde el tablero del circuito hasta
// cada uno de sus equipos, sin que el usuario tenga que trazar cada
// tramo final a mano.
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

// --- 0. Tablero real + circuito con 2 equipos ---
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: "+ Nuevo tablero", exact: true }).click();
await page.waitForTimeout(150);
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("TD-RUTA-AUTO");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(200);

await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Ej: Iluminación cocina").fill("Circuito ruta auto");
await page.locator("label", { hasText: "Distancia (m)" }).locator("xpath=following-sibling::input[1]").fill("10");
await page.getByRole("button", { name: "+ Crear circuito" }).click();
await page.waitForTimeout(200);
await page.getByLabel("Tablero de Circuito ruta auto").selectOption({ label: "TD-RUTA-AUTO" });
await page.waitForTimeout(150);

await page.getByPlaceholder("Ej: Refrigerador").fill("Lámpara ruta auto");
await page.locator("label", { hasText: "P unitaria (W)" }).locator("xpath=following-sibling::input[1]").fill("15");
await page.getByRole("button", { name: "+ Agregar equipo" }).click();
await page.waitForTimeout(200);

await page.getByPlaceholder("Ej: Refrigerador").fill("Tomacorriente ruta auto");
await page.locator("label", { hasText: "P unitaria (W)" }).locator("xpath=following-sibling::input[1]").fill("180");
await page.getByRole("button", { name: "+ Agregar equipo" }).click();
await page.waitForTimeout(200);

// --- 1. Plano: imagen + calibración (400px = 5m) ---
await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);
const panelPlano = page.getByText("Plano inteligente", { exact: true }).locator("xpath=../../..");

await page.locator('input[type="file"][accept="image/*,application/pdf"]').setInputFiles(DIR + "fixtures/plano_test.png");
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

// --- 2. Colocar el marcador del TABLERO (vinculado a TD-RUTA-AUTO) en (100,100) ---
await page.getByRole("button", { name: "Colocar equipo", exact: true }).click();
await page.waitForTimeout(150);
const toolbarEquipo = page.locator("select", { hasText: "¿Equipo ya ingresado?" }).locator("xpath=..");
const selectTipo = toolbarEquipo.locator("select").nth(1);
await selectTipo.selectOption("tablero_electrico");
await page.waitForTimeout(100);
const selectVincularA = toolbarEquipo.locator("select").last();
await selectVincularA.selectOption({ label: "TD-RUTA-AUTO" });
p = await puntoPantallaDesdeImagen({ x: 100, y: 100 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(250);

// --- 3. Colocar los 2 equipos YA ingresados, en puntos específicos ---
const selectYaIngresado = toolbarEquipo.locator("select").nth(0);
await selectYaIngresado.selectOption({ label: await selectYaIngresado.locator("option").filter({ hasText: "Lámpara ruta auto" }).textContent() });
await page.waitForTimeout(100);
p = await puntoPantallaDesdeImagen({ x: 300, y: 100 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(250);

await selectYaIngresado.selectOption({ label: await selectYaIngresado.locator("option").filter({ hasText: "Tomacorriente ruta auto" }).textContent() });
await page.waitForTimeout(100);
p = await puntoPantallaDesdeImagen({ x: 300, y: 300 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(250);

assert((await panelPlano.getByText("Equipos en el plano (3)").count()) === 1, "Tablero + 2 equipos colocados (3 marcadores)");

// --- 4. Sin red trazada todavía: "Sugerir ruta automática" no encuentra camino para ninguno ---
const selectCircuitoRuta = page.locator("select").filter({ has: page.locator('option:has-text("¿Sugerir ruta para qué circuito?")') });
await selectCircuitoRuta.selectOption({ label: await selectCircuitoRuta.locator("option").filter({ hasText: "Circuito ruta auto" }).textContent() });
await page.getByRole("button", { name: "Sugerir ruta automática", exact: true }).click();
await page.waitForTimeout(250);
assert((await page.getByText(/Sin conexión encontrada para:/).count()) >= 1, "Sin red de conductores trazada, avisa que no encontró conexión (no inventa una línea recta)");
assert((await panelPlano.getByText("Rutas de conductor (0)").count()) === 1, "No se generó ninguna ruta sin red trazada");

// --- 5. Trazar la red de conductores a mano como una "Y": tablero -> J,
//     J -> lámpara, J -> tomacorriente (3 tramos separados que se
//     encuentran en J, ninguno llega de punta a punta solo) — así el
//     camino tablero→lámpara y tablero→tomacorriente son cada uno una
//     combinación de 2 tramos, nunca idéntico a un tramo ya existente
//     por sí solo (si la red fuera un solo trazo continuo de punta a
//     punta, el camino al extremo más lejano COINCIDIRÍA exactamente
//     con ese trazo manual y no generaría una ruta nueva — comportamiento
//     correcto de la deduplicación, pero no lo que esta prueba quiere
//     verificar). J = (200,200), lejos de cualquier marcador.
await page.getByRole("button", { name: "Trazar conductor", exact: true }).click();
await page.waitForTimeout(150);

async function trazarTramo(puntoA, puntoB, nombre) {
  for (const punto of [puntoA, puntoB]) {
    const pp = await puntoPantallaDesdeImagen(punto);
    await page.mouse.click(pp.x, pp.y);
    await page.waitForTimeout(150);
  }
  page.once("dialog", (d) => d.accept(nombre));
  await page.getByRole("button", { name: /Terminar ruta/ }).click();
  await page.waitForTimeout(250);
}

const J = { x: 200, y: 200 };
await trazarTramo({ x: 100, y: 100 }, J, "Tramo tablero-J");
await trazarTramo(J, { x: 300, y: 100 }, "Tramo J-lámpara");
await trazarTramo(J, { x: 300, y: 300 }, "Tramo J-tomacorriente");
assert((await panelPlano.getByText("Rutas de conductor (3)").count()) === 1, "La red en 'Y' se trazó a mano (3 tramos manuales)");

// --- 6. Ahora sí, "Sugerir ruta automática" encuentra el camino más
//     corto hasta CADA equipo sobre esa red — 2 rutas nuevas. ---
await page.getByRole("button", { name: "Sugerir ruta automática", exact: true }).click();
await page.waitForTimeout(300);
assert((await page.getByText(/2 ruta\(s\) generada\(s\) siguiendo la red/).count()) >= 1, "Avisa que generó 2 rutas siguiendo la red ya trazada");
assert((await panelPlano.getByText("Rutas de conductor (5)").count()) === 1, "Total 5 rutas: 3 tramos manuales + 2 generadas automáticamente (tablero→lámpara, tablero→tomacorriente, cada una vía J)");

const nombresRutas = await panelPlano.locator('input[value^="Auto: "]').evaluateAll((inputs) => inputs.map((i) => i.value));
assert(nombresRutas.some((n) => n.includes("Lámpara ruta auto")), "Una ruta automática apunta a 'Lámpara ruta auto'");
assert(nombresRutas.some((n) => n.includes("Tomacorriente ruta auto")), "La otra apunta a 'Tomacorriente ruta auto'");

// Cada tramo de la "Y" mide √(100²+100²)px ≈141.42px * 0.0125 m/px ≈
// 1.768m — tablero→lámpara y tablero→tomacorriente combinan 2 tramos
// cada una (vía J): ≈3.54m cada camino (son simétricos en esta "Y").
async function longitudDeRutaConNombre(fragmentoNombre) {
  const todas = await panelPlano.locator('input[value^="Auto: "]').all();
  for (const input of todas) {
    const valor = await input.inputValue();
    if (valor.includes(fragmentoNombre)) {
      const texto = await input.locator("xpath=../../div[contains(., 'longitud trazada')]").first().textContent();
      const m = texto.match(/longitud trazada ([\d.]+) m/);
      return m ? parseFloat(m[1]) : null;
    }
  }
  return null;
}
const longitudLampara = await longitudDeRutaConNombre("Lámpara ruta auto");
const longitudTomacorriente = await longitudDeRutaConNombre("Tomacorriente ruta auto");
assert(longitudLampara !== null && Math.abs(longitudLampara - 3.54) < 0.3, `La ruta a la lámpara mide ≈3.54m (tablero→J→lámpara) (real: ${longitudLampara})`);
assert(longitudTomacorriente !== null && Math.abs(longitudTomacorriente - 3.54) < 0.3, `La ruta al tomacorriente mide ≈3.54m (tablero→J→tomacorriente) (real: ${longitudTomacorriente})`);

// --- 7. Correr "Sugerir ruta automática" de NUEVO: no duplica nada (mismo camino ya existe) ---
await page.getByRole("button", { name: "Sugerir ruta automática", exact: true }).click();
await page.waitForTimeout(300);
assert((await panelPlano.getByText("Rutas de conductor (5)").count()) === 1, "Correr de nuevo no duplica las rutas ya generadas (siguen siendo 5)");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/ruta_automatica_plano.png", fullPage: true });
await browser.close();
