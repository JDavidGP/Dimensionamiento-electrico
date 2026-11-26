// Diferencial (ID) — REBT ITC-BT-25, cita exacta: "garantizando un
// máximo de cinco circuitos por cada diferencial". Usuario, 2026-11-25:
// discutiendo la jerarquía REBT (ICP→IGA→Diferencial→PIA→consumidores)
// frente al modelo más plano de NEC, señaló que el Diferencial "agrupa
// x cantidad de PIA según normativa... así que supongo que si debería
// tener su propio marcador en el plano" — confirmado, y el límite de 5
// confirmado FIJO ("usa el 5 fijo por ahora"). REBT únicamente: NEC/CIEN
// no tienen este concepto de agrupación (GFCI/AFCI van por circuito).
//
// Cubre: creación (PanelDiferenciales, solo bajo IEC_ES), asignación de
// circuitos (select en TablaResultados), la advertencia de ITC-BT-25 al
// superar 5, y el marcador propio en el Plano (colocación manual +
// mover + la limpieza de referencias muertas al eliminar el diferencial
// real — mismo criterio ya verificado para Circuito en
// test_marcador_circuito_plano_ui.mjs).
import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
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

// --- 0. Normativa IEC_ES (REBT) — el Diferencial es exclusivo de esta normativa ---
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

// --- 1. Tableros: PanelDiferenciales visible bajo IEC_ES, crear 1 ---
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);
assert((await page.getByText("Diferenciales (ID)", { exact: true }).count()) === 1, "El panel de Diferenciales aparece bajo IEC_ES");

await page.getByRole("button", { name: "+ Nuevo diferencial" }).click();
await page.getByPlaceholder("Ej: ID planta baja").fill("ID-1");
await page.getByRole("button", { name: "+ Crear diferencial" }).click();
await page.waitForTimeout(200);
assert((await page.getByText("ID-1", { exact: true }).count()) >= 1, "Diferencial ID-1 creado");

// --- 2. Circuitos y resultados: crear 6 circuitos y asignarlos todos a ID-1 ---
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);

async function crearCircuito(nombre) {
  await page.getByPlaceholder("Ej: Iluminación cocina").fill(nombre);
  await page.locator("label:has-text('Distancia (m)')").locator("..").locator("input").fill("8");
  await page.getByRole("button", { name: "+ Crear circuito" }).click();
  await page.waitForTimeout(150);
}

for (let i = 1; i <= 6; i++) {
  await crearCircuito(`Circuito ${i}`);
}

async function asignarADiferencial(nombreCircuito, nombreDiferencial) {
  const fila = page.locator("div").filter({ hasText: nombreCircuito }).filter({ has: page.getByLabel(`Diferencial de ${nombreCircuito}`) }).first();
  const select = page.getByLabel(`Diferencial de ${nombreCircuito}`);
  await select.selectOption({ label: nombreDiferencial });
}

for (let i = 1; i <= 6; i++) {
  await asignarADiferencial(`Circuito ${i}`, "ID-1");
  await page.waitForTimeout(80);
}

// --- 3. La advertencia de ITC-BT-25 aparece con 6 (> 5) ---
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(250);
const panelDiferenciales = page.getByText("Diferenciales (ID)", { exact: true }).locator("xpath=../..");
await panelDiferenciales.getByText("ID-1", { exact: true }).click();
await page.waitForTimeout(150);
assert(
  (await page.getByText(/Agrupa 6 circuitos.*máximo de 5/).count()) >= 1,
  "Con 6 circuitos asignados, avisa que ITC-BT-25 permite máximo 5 por diferencial"
);

// --- 3b. Desasignar uno (vuelve a 5): la advertencia desaparece ---
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(250);
await page.getByLabel("Diferencial de Circuito 6").selectOption({ label: "— sin diferencial —" });
await page.waitForTimeout(150);

// --- 3c. ITC-BT-25 §2.1 (usuario, 2026-11-26, "citar normativas para
//     las distancias de instalación"): a diferencia del límite de 5 (un
//     exceso puntual), REBT exige diferencial en TODOS los circuitos
//     sin excepción — "Circuito 6" recién desasignado debe avisarlo, los
//     5 que SIGUEN con ID-1 asignado no. Cada tarjeta se acota desde el
//     botón "Editar circuito X" (único por nombre) hasta su tarjeta
//     completa (2 niveles arriba: botón -> fila de encabezado -> tarjeta
//     con el detalle), para no mezclarla con las de otros circuitos.
const tarjetaCircuito6 = page.getByRole("button", { name: "Editar circuito Circuito 6" }).locator("xpath=../..");
assert((await tarjetaCircuito6.getByText(/ITC-BT-25 §2.1/).count()) === 1, "'Circuito 6', recién sin diferencial, avisa ITC-BT-25 §2.1 (todo circuito debe tener uno)");

// "Circuito 1" no se auto-expande solo (solo el último creado lo hace)
// — hay que abrirlo a mano para poder revisar su propio detalle.
const filaCircuito1 = page.getByRole("button", { name: "Editar circuito Circuito 1" }).locator("xpath=..");
await filaCircuito1.click({ position: { x: 10, y: 10 } }); // esquina izquierda de la fila — lejos de los botones ✎/× de la derecha
await page.waitForTimeout(150);
const tarjetaCircuito1 = page.getByRole("button", { name: "Editar circuito Circuito 1" }).locator("xpath=../..");
assert((await tarjetaCircuito1.getByText(/ITC-BT-25 §2.1/).count()) === 0, "'Circuito 1', que SIGUE con ID-1 asignado, no muestra el aviso");

await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(250);
assert((await page.getByText(/Agrupa 6 circuitos/).count()) === 0, "Al volver a 5 circuitos, la advertencia de ITC-BT-25 (límite de 5) desaparece");

// --- 4. Marcador propio en el Plano: colocar a mano, vincular, mover ---
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

await page.getByRole("button", { name: "Colocar equipo", exact: true }).click();
await page.waitForTimeout(150);
const toolbarEquipo = page.locator("select", { hasText: "¿Equipo ya ingresado?" }).locator("xpath=..");
const selectTipo = toolbarEquipo.locator("select").nth(1);
await selectTipo.selectOption("diferencial");
await page.waitForTimeout(100);
const selectVincularA = toolbarEquipo.locator("select").last();
assert((await selectVincularA.locator("option").filter({ hasText: "ID-1" }).count()) === 1, "El diferencial real aparece como candidato para 'Vincular a' al elegir el tipo 'Diferencial (ID)'");
await selectVincularA.selectOption({ label: await selectVincularA.locator("option").filter({ hasText: "ID-1" }).textContent() });
p = await puntoPantallaDesdeImagen({ x: 200, y: 200 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(300);

assert((await panelPlano.getByText("Equipos en el plano (1)").count()) === 1, "Se creó el marcador del diferencial");
const listaEquiposPlano = panelPlano.getByText(/^Equipos en el plano \(/).locator("xpath=following-sibling::div[1]");
assert((await listaEquiposPlano.getByText("Diferencial (ID)", { exact: true }).count()) === 1, "El marcador colocado a mano muestra el símbolo 'Diferencial (ID)'");
const tarjetaDiferencial = listaEquiposPlano.locator("div").filter({ hasText: "Diferencial (ID)" }).first();
assert((await tarjetaDiferencial.locator("select").last().locator("option:checked").textContent()).includes("ID-1"), "Quedó vinculado al diferencial real elegido, con su cuenta de circuitos en la etiqueta");

// Mover — se puede mover como cualquier otro marcador
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
assert((await panelPlano.getByText("Equipos en el plano (1)").count()) === 1, "Mover el marcador del diferencial no lo duplica ni lo borra — sigue siendo 1");

// --- 5. Eliminar el diferencial REAL: el marcador queda DESVINCULADO, no destruido (mismo criterio que Circuito/Tablero/...) ---
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(250);
await page.getByRole("button", { name: "Eliminar diferencial ID-1" }).click();
await page.waitForTimeout(200);

await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);
assert((await panelPlano.getByText("Equipos en el plano (1)").count()) === 1, "El marcador NO se borró al eliminar el diferencial real — queda desvinculado, no destruido");
const tarjetaTrasEliminar = panelPlano.getByText(/^Equipos en el plano \(/).locator("xpath=following-sibling::div[1]").locator("div").filter({ hasText: "Diferencial (ID)" }).first();
assert((await tarjetaTrasEliminar.locator("select").last().locator("option:checked").textContent()).includes("Sin vincular"), "Tras eliminar el diferencial real, el marcador queda 'Sin vincular' (no apunta a un id muerto)");

// Y los 5 circuitos que agrupaba quedaron sin asignar (no se borraron)
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(250);
assert((await page.getByLabel("Diferencial de Circuito 1").locator("option:checked").textContent()).includes("sin diferencial"), "Al eliminar el diferencial, los circuitos que agrupaba quedan sin asignar (no se borran)");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/diferencial.png", fullPage: true });
await browser.close();
