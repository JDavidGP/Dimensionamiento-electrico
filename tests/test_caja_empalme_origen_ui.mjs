// Caja de empalme como origen real de "Sugerir ruta automática" +
// "sepa qué circuito(s) pasan por ella" — usuario, 2026-11-26,
// retomando el punto dejado pendiente a propósito el 2026-11-24 ("la
// opción 1 me sirve por el momento"). Prueba la UI real: colocar una
// caja de empalme SOBRE un nodo real de la red de conductores, generar
// una ruta desde ella (en vez de desde el tablero), vincularla a un
// circuito, y confirmar que la caja ahora reporta ese circuito como
// "pasando por acá".
import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1300 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto(process.env.BASE_URL || "http://localhost:4343", { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

// --- 1. Un circuito con 1 equipo real (para tener un destino real de ruteo) ---
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Ej: Iluminación cocina").fill("Circuito caja");
await page.locator("label", { hasText: "Distancia (m)" }).locator("xpath=following-sibling::input[1]").fill("1");
await page.getByRole("button", { name: "+ Crear circuito" }).click();
await page.waitForTimeout(200);
await page.getByPlaceholder("Ej: Refrigerador").fill("Tomacorriente caja");
await page.locator("label", { hasText: "P unitaria (W)" }).locator("xpath=following-sibling::input[1]").fill("180");
await page.getByRole("button", { name: "+ Agregar equipo" }).click();
await page.waitForTimeout(200);

// --- 2. Ir al Plano, cargar imagen, calibrar (400px = 5m) ---
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

await panelPlano.getByRole("button", { name: "Calibrar", exact: true }).click();
await page.waitForTimeout(150);
await click({ x: 100, y: 100 });
await click({ x: 500, y: 100 });
await panelPlano.getByPlaceholder("Ej: 5").fill("5");
await panelPlano.getByRole("button", { name: "Calibrar", exact: true }).last().click();
await page.waitForTimeout(200);

// --- 3. Trazar una red con 2 waypoints intermedios reales — cada par
//     de clicks consecutivos queda registrado como su PROPIA ruta de
//     conductor (A-B y B-C quedan ya "Vincular a"-bles de una), pero el
//     GRAFO de nodos/segmentos subyacente (el que usa el Dijkstra de
//     "Sugerir ruta automática") sigue siendo uno solo compartido — acá
//     se usan 3 segmentos (A-B-C-D) para que el camino de la CAJA (en
//     B) al equipo (en D) sea un camino de 2 saltos (B→C→D), distinto
//     de cualquier ruta YA registrada a mano (A-B, B-C o C-D sueltas) —
//     si no, "Sugerir ruta automática" lo deduplicaría contra la ruta
//     manual ya existente y no generaría nada nuevo que observar. ---
await panelPlano.getByRole("button", { name: "Trazar conductor", exact: true }).click();
await page.waitForTimeout(100);
// Asistencia de bordes (pega el click al filo más cercano) — a propósito
// APAGADA: el fixture es un color sólido plano, sin ningún borde real
// que "pegar", así que queremos las coordenadas EXACTAS que clickeamos.
await panelPlano.locator("label", { hasText: "Asistencia de bordes" }).locator('input[type="checkbox"]').uncheck();
await page.waitForTimeout(80);
await click({ x: 100, y: 300 }); // A
await click({ x: 150, y: 300 }); // B — acá va la caja de empalme
await click({ x: 350, y: 300 }); // C
await click({ x: 500, y: 300 }); // D — acá va el equipo
await panelPlano.getByRole("button", { name: /Terminar ruta/ }).click();
await page.waitForTimeout(200);

// --- 4. Colocar la caja de empalme EXACTAMENTE sobre ese nodo (150,300) ---
await panelPlano.getByRole("button", { name: "Colocar equipo", exact: true }).click();
await page.waitForTimeout(100);
const selectTipoEquipo = panelPlano.locator("select").filter({ has: page.locator('option:has-text("Caja de empalme")') });
await selectTipoEquipo.selectOption({ label: "Caja de empalme" });
await panelPlano.getByPlaceholder("Nombre (opcional)").first().fill("Caja 1");
await click({ x: 150, y: 300 });
await page.waitForTimeout(200);

assert((await page.getByText(/Todavía ningún circuito\/tablero vinculado pasa por acá/).count()) === 1, "Recién colocada, sin ninguna ruta vinculada, la caja avisa que todavía nadie pasa por ahí");

// --- 5. "Generar circuito": 1 click genera el marcador del circuito + su equipo, YA VINCULADO al equipo real ---
await panelPlano.getByRole("button", { name: "Generar circuito", exact: true }).click();
await page.waitForTimeout(100);
const selectGenerarCircuito = panelPlano.locator("select").filter({ has: page.locator('option:has-text("¿Qué circuito?")') });
await selectGenerarCircuito.selectOption({ label: await selectGenerarCircuito.locator("option").filter({ hasText: "Circuito caja" }).textContent() });
// El equipo se genera con un offset de 18px respecto al click (ver
// SEPARACION_GRUPO_PX, useCircuitos.js) — clickeamos 18px antes en
// cada eje para que el EQUIPO (no el marcador del circuito en sí)
// quede exactamente sobre el nodo D (500,300) del conductor ya trazado.
await click({ x: 482, y: 282 });
await page.waitForTimeout(200);
assert((await page.getByText(/Se generó el marcador del circuito \(PIA\) \+ 1 equipo\(s\)/).count()) >= 1, "Generó el marcador del circuito + su único equipo, ya vinculado");

// --- 6. "Sugerir ruta automática", eligiendo la CAJA como origen (no el tablero) ---
const selectOrigen = panelPlano.locator("select").filter({ hasText: "Desde:" });
await selectOrigen.selectOption({ label: "Desde: Caja 1" });
const selectCircuitoRuta = panelPlano.locator("select").filter({ has: page.locator('option:has-text("¿Sugerir ruta para qué circuito?")') });
await selectCircuitoRuta.selectOption({ label: await selectCircuitoRuta.locator("option").filter({ hasText: "Circuito caja" }).textContent() });
await page.waitForTimeout(100);
await panelPlano.getByRole("button", { name: "Sugerir ruta automática", exact: true }).click();
await page.waitForTimeout(200);

// El nombre de la ruta vive en un <input> (editable con "renombrarRutaConductorPlano"), no en un nodo de texto plano.
const inputRutaGenerada = panelPlano.locator('input[value*="Auto: Caja 1"]');
assert((await inputRutaGenerada.count()) === 1, "Se generó una nueva ruta nombrada 'Auto: Caja 1 → ...' (no deduplicada contra la ruta manual)");
const textoRutaGenerada = await inputRutaGenerada.inputValue();
assert(/Auto: Caja 1 → Tomacorriente caja/.test(textoRutaGenerada), `La ruta generada arranca desde la CAJA, no del tablero (real: '${textoRutaGenerada}')`);

// --- 7. Vincular esa ruta recién generada al circuito -> la caja ahora SÍ reporta que ese circuito pasa por acá ---
const selectVincular = inputRutaGenerada.locator("xpath=../..").locator("select").filter({ hasText: "Vincular a" });
await selectVincular.selectOption({ label: "Circuito caja" });
await page.waitForTimeout(150);

const avisoCaja = await page.getByText(/Pasan por acá/).textContent();
assert(/Circuito caja/.test(avisoCaja), `Tras vincular la ruta, la caja reporta el circuito pasando por acá (real: '${avisoCaja}')`);

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await browser.close();
