// "Diagrama sobre plano" — vista combinada de solo lectura — usuario,
// 2026-11-22: "continuemos con diagrama unifilar y planos como dos
// lienzos separados" -> "Superponer el diagrama SOBRE el plano
// (recomendado)". Prueba end-to-end: 2 tableros reales, cada uno con
// un nodo en el diagrama Y un marcador en el plano (mismo entidadId),
// una conexión entre esos 2 nodos, y un 3er nodo SIN marcador en el
// plano conectado al 2do -> esa conexión NO debe dibujarse.
import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4343"), { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

// --- 0. Dos tableros reales ---
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(200);
for (const nombre of ["TD-OVERLAY-1", "TD-OVERLAY-2"]) {
  await page.getByRole("button", { name: "+ Nuevo tablero", exact: true }).click();
  await page.waitForTimeout(150);
  await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill(nombre);
  await page.getByRole("button", { name: "+ Crear tablero" }).click();
  await page.waitForTimeout(200);
}

// --- 1. Plano: cargar imagen, calibrar (400px = 5m -> 0.0125 m/px) ---
await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);

const panelPlano = page.getByText("Plano inteligente", { exact: true }).locator("xpath=../../..");
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

await page.locator('input[type="file"][accept="image/*,application/pdf"]').setInputFiles(
  DIR + "fixtures/plano_test.png"
);
await page.waitForTimeout(400);
await panelPlano.getByRole("button", { name: "Calibrar", exact: true }).click();
await page.waitForTimeout(150);
await click({ x: 100, y: 100 });
await click({ x: 500, y: 100 });
await panelPlano.getByPlaceholder("Ej: 5").fill("5");
await panelPlano.getByRole("button", { name: "Calibrar", exact: true }).last().click();
await page.waitForTimeout(200);

// --- 2. Colocar 2 equipos ("Tablero eléctrico"), cada uno vinculado a un tablero real ---
await panelPlano.getByRole("button", { name: "Colocar equipo", exact: true }).click();
await page.waitForTimeout(150);
// .first() porque, una vez que ya existe al menos 1 equipo marcado, la
// lista "Equipos en el plano" también tiene su propio campo "Nombre
// (opcional)" (edición inline) — sin acotar, el selector de abajo
// terminaba agarrando el <select> "Vincular a" de un marcador YA
// creado en la lista, en vez del de esta barra de herramientas.
const barraEquipo = page.locator('input[placeholder="Nombre (opcional)"]').first().locator("xpath=..");
// select(0) es "¿Equipo ya ingresado?" (usuario, 2026-11-25) — el tipo
// de equipo es el select(1) de esta barra.
const SELECT_TIPO_EQUIPO = 1;

await barraEquipo.locator("select").nth(SELECT_TIPO_EQUIPO).selectOption("tablero_electrico");
await page.waitForTimeout(100);
await barraEquipo.locator("select").last().selectOption({ label: "TD-OVERLAY-1" });
await click({ x: 300, y: 250 });
await page.waitForTimeout(200);

await barraEquipo.locator("select").nth(SELECT_TIPO_EQUIPO).selectOption("tablero_electrico");
await page.waitForTimeout(100);
await barraEquipo.locator("select").last().selectOption({ label: "TD-OVERLAY-2" });
await click({ x: 300, y: 450 });
await page.waitForTimeout(200);

assert((await panelPlano.getByText("Equipos en el plano (2)").isVisible()), "Se colocaron 2 equipos en el plano, cada uno vinculado a un tablero real");

// --- 3. Diagrama unifilar: 3 nodos (2 vinculados a esos tableros, 1 sin marcador en el plano) ---
await page.getByRole("button", { name: "Diagrama unifilar", exact: true }).click();
await page.waitForTimeout(200);

const panelDiagrama = page.getByText("Diagrama unifilar", { exact: true }).nth(1).locator("xpath=../..");
const selectTipoNodo = panelDiagrama.locator("select").first();
const inputNombreNodo = panelDiagrama.getByPlaceholder("Nombre (ej. Q1, TD-01)");
const selectEntidadNodo = panelDiagrama.locator("select").filter({ hasText: "Vincular a (opcional)" });
const botonAgregarNodo = panelDiagrama.getByRole("button", { name: "+ Agregar", exact: true });

async function agregarNodoVinculado(nombre, entidadLabel) {
  await selectTipoNodo.selectOption("tablero_electrico");
  await page.waitForTimeout(80);
  await inputNombreNodo.fill(nombre);
  if (entidadLabel) await selectEntidadNodo.selectOption({ label: entidadLabel });
  await botonAgregarNodo.click();
  await page.waitForTimeout(100);
}

await agregarNodoVinculado("ND-1", "TD-OVERLAY-1");
await agregarNodoVinculado("ND-2", "TD-OVERLAY-2");
await agregarNodoVinculado("ND-3", null); // sin vincular a ningún tablero/marcador

const cantidadNodos = await panelDiagrama.locator("svg g").count();
console.log("Nodos en el diagrama:", cantidadNodos);

await panelDiagrama.getByRole("button", { name: "Conectar", exact: true }).click();
await page.waitForTimeout(100);
async function conectar(origen, destino) {
  await panelDiagrama.locator("svg text", { hasText: origen }).first().click();
  await page.waitForTimeout(80);
  await panelDiagrama.locator("svg text", { hasText: destino }).first().click();
  await page.waitForTimeout(150);
}
// El diagrama muestra el nombre VIVO de la entidad vinculada (no el
// nombre tipeado al crear el nodo) — ver App.diagrama.resolverEntidad.
await conectar("TD-OVERLAY-1", "TD-OVERLAY-2"); // ambos extremos resolubles -> SE dibuja en el overlay
await conectar("TD-OVERLAY-2", "ND-3"); // ND-3 sin marcador -> NO se dibuja en el overlay

// --- 4. "Diagrama sobre plano": verificar overlay ---
await page.getByRole("button", { name: "Diagrama sobre plano", exact: true }).click();
await page.waitForTimeout(300);

const panelCombinado = page.getByText(/Conexiones del diagrama unifilar dibujadas sobre el plano/).locator("xpath=..");
const textoResumen = await panelCombinado.textContent();
console.log("Texto resumen vista combinada:", textoResumen);
assert(/1 de 2 conexiones ubicadas/.test(textoResumen), `El resumen informa 1 de 2 conexiones ubicadas (real: "${textoResumen}")`);
assert(/la otra conexión no se dibuja/.test(textoResumen), `El resumen usa singular correcto para 1 conexión sin resolver (real: "${textoResumen}")`);

const lineasOverlay = panelCombinado.locator('line[marker-end="url(#flecha-plano-diagrama)"]');
assert((await lineasOverlay.count()) === 1, `Se dibuja exactamente 1 línea de overlay (la conexión ND-1 -> ND-2 resoluble) (real: ${await lineasOverlay.count()})`);

// El marcador de flecha del overlay existe en el <defs>.
assert((await panelCombinado.locator("marker#flecha-plano-diagrama").count()) === 1, "El marcador de flecha del overlay está definido en el SVG");

// Los 2 equipos marcados siguen visibles (símbolos del plano, sin duplicar).
assert((await panelCombinado.getByText(/Cargá un plano/).count()) === 0, "No se muestra el mensaje de 'sin plano' (ya hay uno cargado)");

await page.screenshot({ path: DIR + "tmp/plano_overlay_diagrama.png", fullPage: true });

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await browser.close();
