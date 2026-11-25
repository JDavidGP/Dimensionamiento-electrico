// Marcador de "Circuito (PIA)" en Plano — usuario, 2026-11-25: "la
// representación de los circuitos en sí... no [están] los circuitos
// individuales que realmente quiero mover en el plano". Hasta esta
// ronda, un Circuito como entidad no tenía NINGÚN marcador propio en
// el plano — solo se veían sus equipos sueltos. Prueba colocarlo a
// mano (vía "Colocar equipo" + "Vincular a", el mismo mecanismo
// genérico que ya usan tablero/transformador/fuenteEnergia) y la
// limpieza de referencias muertas al eliminar el circuito real (bug
// preexistente encontrado de paso: eliminar un equipo/circuito/
// tablero/fuente/transformador limpiaba sus nodos del DIAGRAMA, pero
// nunca sus marcadores del PLANO).
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

// --- 0. Un circuito real para vincular ---
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Ej: Iluminación cocina").fill("Circuito marcador manual");
await page.locator("label", { hasText: "Distancia (m)" }).locator("xpath=following-sibling::input[1]").fill("8");
await page.getByRole("button", { name: "+ Crear circuito" }).click();
await page.waitForTimeout(200);

// --- 1. Plano: imagen + calibración ---
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

// --- 2. "Colocar equipo" → tipo "Circuito (PIA)" → "Vincular a" el circuito real ---
await page.getByRole("button", { name: "Colocar equipo", exact: true }).click();
await page.waitForTimeout(150);
const toolbarEquipo = page.locator("select", { hasText: "¿Equipo ya ingresado?" }).locator("xpath=..");
const selectTipo = toolbarEquipo.locator("select").nth(1);
await selectTipo.selectOption("circuito");
await page.waitForTimeout(100);
const selectVincularA = toolbarEquipo.locator("select").last();
assert((await selectVincularA.locator("option").filter({ hasText: "Circuito marcador manual" }).count()) === 1, "El circuito real aparece como candidato para 'Vincular a' al elegir el tipo 'Circuito (PIA)'");
await selectVincularA.selectOption({ label: await selectVincularA.locator("option").filter({ hasText: "Circuito marcador manual" }).textContent() });
p = await puntoPantallaDesdeImagen({ x: 200, y: 200 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(300);

assert((await panelPlano.getByText("Equipos en el plano (1)").count()) === 1, "Se creó el marcador del circuito");
const listaEquiposPlano = panelPlano.getByText(/^Equipos en el plano \(/).locator("xpath=following-sibling::div[1]");
assert((await listaEquiposPlano.getByText("Circuito (PIA)", { exact: true }).count()) === 1, "El marcador colocado a mano muestra el símbolo 'Circuito (PIA)'");
const tarjetaCircuito = listaEquiposPlano.locator("div").filter({ hasText: "Circuito (PIA)" }).first();
assert((await tarjetaCircuito.locator("select").last().locator("option:checked").textContent()).includes("Circuito marcador manual"), "Quedó vinculado al circuito real elegido");

// --- 3. "Mover equipo" — se puede mover como cualquier otro marcador ---
await page.getByRole("button", { name: "Mover equipo", exact: true }).click();
await page.waitForTimeout(150);
const pInicio = await puntoPantallaDesdeImagen({ x: 200, y: 200 });
const pFin = await puntoPantallaDesdeImagen({ x: 400, y: 350 });
await page.mouse.move(pInicio.x, pInicio.y);
await page.mouse.down();
await page.mouse.move((pInicio.x + pFin.x) / 2, (pInicio.y + pFin.y) / 2, { steps: 5 });
await page.mouse.move(pFin.x, pFin.y, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(300);
assert((await panelPlano.getByText("Equipos en el plano (1)").count()) === 1, "Mover el marcador del circuito no lo duplica ni lo borra — sigue siendo 1");

// --- 4. Eliminar el circuito REAL (desde Circuitos y resultados): el
//     marcador del plano queda DESVINCULADO (entidadId -> null), no
//     borrado ni apuntando a un id muerto — mismo criterio que ya
//     existía para los nodos del Diagrama unifilar. ---
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Eliminar circuito Circuito marcador manual" }).click();
await page.waitForTimeout(200);

await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);
assert((await panelPlano.getByText("Equipos en el plano (1)").count()) === 1, "El marcador NO se borró al eliminar el circuito real — queda desvinculado, no destruido");
const tarjetaTrasEliminar = panelPlano.getByText(/^Equipos en el plano \(/).locator("xpath=following-sibling::div[1]").locator("div").filter({ hasText: "Circuito (PIA)" }).first();
assert((await tarjetaTrasEliminar.locator("select").last().locator("option:checked").textContent()).includes("Sin vincular"), "Tras eliminar el circuito real, el marcador queda 'Sin vincular' (no apunta a un id muerto)");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/marcador_circuito_plano.png", fullPage: true });
await browser.close();
