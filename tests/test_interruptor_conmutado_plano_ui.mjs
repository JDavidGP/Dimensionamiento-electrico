// Interruptor conmutado + luminaria que controla — usuario, 2026-11-25:
// "generar el símbolo del interruptor conmutado junto el punto de luz
// que controla, para ubicar geográficamente los interruptores
// conmutado junto su punto de luz y poder vincular de manera mas
// versátil y sencilla". Nuevo vínculo MARCADOR-A-MARCADOR (distinto
// del vínculo marcador-a-entidad que ya existía): MarcadorEquipoPlano.
// controlaMarcadorId. Varios interruptores pueden apuntar a la MISMA
// luminaria (3/4 vías) — no es un vínculo exclusivo. Si la luminaria
// vinculada se borra, la referencia queda "suave": no rompe nada, el
// select la muestra como "(luminaria eliminada)" en vez de fallar.
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

await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);
const panelPlano = page.getByText("Plano inteligente", { exact: true }).locator("xpath=../../..");
// Mismo criterio de alcance que test_equipo_ya_ingresado_plano_ui.mjs:
// TabsViewPager mantiene montado el Directorio (su propio resumen
// "Equipos en el plano") a la vez — acotar al contenedor inmediato
// siguiente al encabezado dentro de panelPlano.
const listaEquiposPlano = panelPlano.getByText(/^Equipos en el plano \(/).locator("xpath=following-sibling::div[1]");

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

// --- 1. Colocar una "Luminaria" ---
await page.getByRole("button", { name: "Colocar equipo", exact: true }).click();
await page.waitForTimeout(150);
// Alcance estable independiente de cuántas tarjetas de marcador ya
// existan en "Equipos en el plano" (cada una tiene SU PROPIO input
// "Nombre (opcional)" — ambigüedad detectada al correr este test:
// anclamos al <select> "¿Equipo ya ingresado?", que existe una sola
// vez en la barra de herramientas sea cual sea el estado del plano.
const toolbarEquipo = page.locator("select", { hasText: "¿Equipo ya ingresado?" }).locator("xpath=..");
const selectTipo = toolbarEquipo.locator("select").nth(1);
const inputNombreToolbar = toolbarEquipo.locator('input[placeholder="Nombre (opcional)"]');
await selectTipo.selectOption("luminaria");
await inputNombreToolbar.fill("Luz sala");
p = await puntoPantallaDesdeImagen({ x: 300, y: 150 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(250);
assert((await panelPlano.getByText("Equipos en el plano (1)").count()) === 1, "Se creó el marcador de la luminaria");

// --- 2. Colocar dos "Interruptor conmutado (3 vías)" (escalera: dos
//     interruptores controlando la misma luz) ---
await selectTipo.selectOption("interruptor_conmutado");
await inputNombreToolbar.fill("Interruptor 1 (abajo)");
p = await puntoPantallaDesdeImagen({ x: 150, y: 350 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(250);

await selectTipo.selectOption("interruptor_conmutado");
await inputNombreToolbar.fill("Interruptor 2 (arriba)");
p = await puntoPantallaDesdeImagen({ x: 450, y: 350 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(250);

assert((await panelPlano.getByText("Equipos en el plano (3)").count()) === 1, "3 marcadores en total: 1 luminaria + 2 interruptores conmutados");

// --- 3. Un marcador de luminaria NO ofrece el select "Controla la
//     luminaria" (solo aplica a interruptor_conmutado) — pero las dos
//     tarjetas de interruptor SÍ, desde el momento en que se colocan,
//     antes de vincular nada todavía. ---
const tarjetaLuminaria = listaEquiposPlano.locator('input[value="Luz sala"]').locator("xpath=..");
assert((await tarjetaLuminaria.getByText("Controla la luminaria", { exact: false }).count()) === 0, "La tarjeta de la luminaria NO ofrece el select 'Controla la luminaria' (no es un interruptor conmutado)");
assert((await listaEquiposPlano.getByText("Controla la luminaria: sin vincular", { exact: false }).count()) === 2, "Las 2 tarjetas de interruptor conmutado SÍ ofrecen el select, todavía sin vincular");

// --- 4. Vincular AMBOS interruptores a la misma luminaria ---
// Cada tarjeta de marcador es un bloque con
// borde — ubicamos las DOS tarjetas por el nombre que les dimos y
// dentro de cada una su propio <select> de vínculo.
const tarjetaInterruptor1 = listaEquiposPlano.locator('input[value="Interruptor 1 (abajo)"]').locator("xpath=..");
const tarjetaInterruptor2 = listaEquiposPlano.locator('input[value="Interruptor 2 (arriba)"]').locator("xpath=..");
const selectControla1 = tarjetaInterruptor1.locator("select").last();
const selectControla2 = tarjetaInterruptor2.locator("select").last();

assert((await selectControla1.locator("option").allTextContents()).some((t) => t.includes("Luz sala")), "El select de vínculo del interruptor 1 ofrece 'Luz sala' como opción");

await selectControla1.selectOption({ label: (await selectControla1.locator("option").filter({ hasText: "Luz sala" }).textContent()) });
await page.waitForTimeout(150);
await selectControla2.selectOption({ label: (await selectControla2.locator("option").filter({ hasText: "Luz sala" }).textContent()) });
await page.waitForTimeout(150);

assert((await selectControla1.locator("option:checked").textContent()).includes("Luz sala"), "Interruptor 1 quedó vinculado a 'Luz sala'");
assert((await selectControla2.locator("option:checked").textContent()).includes("Luz sala"), "Interruptor 2 TAMBIÉN quedó vinculado a la MISMA luz (escalera, 3 vías) — no es un vínculo exclusivo");

// --- 5. El conector punteado se dibuja en el lienzo: 2 <line> nuevas ---
const lineasConector = await page.locator('svg line[stroke-dasharray]').count();
assert(lineasConector >= 2, `Se dibujan al menos 2 líneas punteadas de conector (real: ${lineasConector})`);

// --- 6. Persistencia: guardar y reabrir conserva el vínculo ---
const [descarga] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "↓ Guardar (.pdf)" }).click(),
]);
const rutaDescargada = DIR + "tmp/interruptor_conmutado.pdf";
await descarga.saveAs(rutaDescargada);
await page.waitForTimeout(200);

await page.reload({ waitUntil: "networkidle" });
await page.locator("label", { hasText: "Abrir" }).locator('input[type="file"]').setInputFiles(rutaDescargada);
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);

const tarjetaInterruptor1TrasReabrir = page.getByText("Plano inteligente", { exact: true }).locator("xpath=../../..").locator('input[value="Interruptor 1 (abajo)"]').locator("xpath=..");
assert((await tarjetaInterruptor1TrasReabrir.locator("select").last().locator("option:checked").textContent()).includes("Luz sala"), "El vínculo interruptor→luminaria persiste tras guardar y reabrir el proyecto");

// --- 7. Borrar la luminaria: la referencia queda "suave" (no rompe
//     nada, se muestra como eliminada) ---
await page.getByRole("button", { name: "Borrar", exact: true }).click();
await page.waitForTimeout(150);
const pLuminaria = await puntoPantallaDesdeImagen({ x: 300, y: 150 });
await page.mouse.click(pLuminaria.x, pLuminaria.y);
await page.waitForTimeout(300);
assert((await page.getByText("Plano inteligente", { exact: true }).locator("xpath=../../..").getByText("Equipos en el plano (2)").count()) === 1, "La luminaria se eliminó (quedan los 2 interruptores)");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo (incluida la referencia suave tras eliminar la luminaria vinculada)");

await browser.close();
