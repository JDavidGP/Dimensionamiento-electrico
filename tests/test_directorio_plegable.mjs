import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4352"), { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

// --- 0. Crear un tablero, un circuito y un equipo (vía sus propias pestañas) ---
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: "+ Nuevo tablero", exact: true }).click();
await page.waitForTimeout(150);
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("Tablero principal");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(200);

await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(200);
await page.getByPlaceholder("Ej: Iluminación cocina").fill("Iluminación cocina");
await page.locator("label", { hasText: "Distancia (m)" }).locator("xpath=following-sibling::input[1]").fill("10");
await page.getByRole("button", { name: "+ Crear circuito" }).click();
await page.waitForTimeout(200);
await page.getByPlaceholder("Ej: Refrigerador").fill("Lámpara LED");
await page.locator("label", { hasText: "P unitaria (W)" }).locator("xpath=following-sibling::input[1]").fill("15");
await page.getByRole("button", { name: "+ Agregar equipo" }).click();
await page.waitForTimeout(200);
// Un circuito no se asigna solo a su tablero al crearse — es un paso
// aparte en TablaResultados (select "Tablero de <circuito>").
await page.getByLabel("Tablero de Iluminación cocina").selectOption({ label: "Tablero principal" });
await page.waitForTimeout(200);

// --- 1. Crear un nodo de diagrama unifilar ---
// Diagrama unifilar y Plano viven agrupados bajo "Esquemas" (ver SubTabs.jsx).
await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Diagrama unifilar", exact: true }).click();
await page.waitForTimeout(200);
const selectTipo = page.locator("select").filter({ has: page.locator('option:has-text("Acometida")') });
await selectTipo.selectOption({ label: "Acometida" });
await page.getByPlaceholder("Nombre (ej. Q1, TD-01)").fill("RED");
await page.getByRole("button", { name: "+ Agregar", exact: true }).click();
await page.waitForTimeout(200);

// --- 2. Crear ambiente + ruta de conductor + marcador de equipo en el Plano (reusa el flujo ya probado) ---
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);
await page.locator('input[type="file"][accept="image/*,application/pdf"]').setInputFiles(
  DIR + "fixtures/plano_test.png"
);
await page.waitForTimeout(400);

// Ya no alcanza con "svg > g" .last() a secas: el Informe técnico
// (pestaña siempre montada) también dibuja el diagrama unifilar
// embebido cuando hay nodos (este test crea uno, "RED", antes de
// llegar acá), Y desde que Diagrama unifilar tiene su propio zoom/pan
// (usuario, 2026-11-20) ESE editor también arma un <g transform=
// "translate(...) scale(...)"> — mismo formato que el de Plano. Se
// escapa de ambos acotando la búsqueda al panel de Plano (identificado
// por su grid 1fr/280px, único en la app) y, DENTRO de ese panel,
// buscando específicamente el <g> con translate+scale (el de un nodo
// del diagrama embebido sería solo "translate(x, y)", sin scale, pero
// ni siquiera debería estar dentro de este panel).
const REGEX_PAN_ZOOM = /translate\(([-\d.]+),([-\d.]+)\) scale\(([-\d.]+)\)/;
// Substring más largo a propósito: "280px" solo matcheaba de más
// (ej. cualquier estilo con "1280px", el ancho del viewport, lo contiene).
const panelPlano = page.locator('div[style*="grid-template-columns: 1fr 280px"]').first();
async function grupoPanZoomPlano() {
  const grupos = await panelPlano.locator("svg > g").all();
  for (const g of grupos) {
    const t = await g.getAttribute("transform");
    if (t && REGEX_PAN_ZOOM.test(t)) return g;
  }
  throw new Error("No se encontró el grupo de pan/zoom del Plano dentro de su panel.");
}
async function puntoPantallaDesdeImagen(puntoImagen) {
  const grupo = await grupoPanZoomPlano();
  const svg = grupo.locator("xpath=..");
  const box = await svg.boundingBox();
  const transformAttr = await grupo.getAttribute("transform");
  const m = transformAttr.match(REGEX_PAN_ZOOM);
  const panX = parseFloat(m[1]), panY = parseFloat(m[2]), zoom = parseFloat(m[3]);
  return { x: box.x + puntoImagen.x * zoom + panX, y: box.y + puntoImagen.y * zoom + panY, zoom };
}

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

await page.getByRole("button", { name: "Trazar pared", exact: true }).click();
await page.waitForTimeout(150);
page.once("dialog", (d) => d.accept("Cocina"));
for (const esquina of [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 400 }, { x: 100, y: 400 }, { x: 100, y: 100 }]) {
  const pp = await puntoPantallaDesdeImagen(esquina);
  await page.mouse.click(pp.x, pp.y);
  await page.waitForTimeout(120);
}
await page.waitForTimeout(200);

await page.getByRole("button", { name: "Trazar conductor", exact: true }).click();
await page.waitForTimeout(150);
for (const punto of [{ x: 100, y: 100 }, { x: 500, y: 100 }]) {
  const pp = await puntoPantallaDesdeImagen(punto);
  await page.mouse.click(pp.x, pp.y);
  await page.waitForTimeout(120);
}
page.once("dialog", (d) => d.accept("Alimentador cocina"));
await page.getByRole("button", { name: /Terminar ruta/ }).click();
await page.waitForTimeout(200);

await page.getByRole("button", { name: "Colocar equipo", exact: true }).click();
await page.waitForTimeout(150);
const pEquipo = await puntoPantallaDesdeImagen({ x: 300, y: 250 });
await page.mouse.click(pEquipo.x, pEquipo.y);
await page.waitForTimeout(200);

// --- 3. Ir a Directorio y verificar el árbol plegable ---
// TabsViewPager mantiene TODA pestaña montada a la vez — la pestaña
// Plano ya tiene su propio panel con los mismos valores (ver
// PlanoInteligente.jsx). Acotamos todo a la propia caja de Directorio
// (su título es único en toda la página) para no chocar con esas
// coincidencias en vez de parchear cada assert por separado.
await page.getByRole("button", { name: "Directorio", exact: true }).click();
await page.waitForTimeout(300);
const panelDirectorio = page.getByText("Directorio — tableros, diagrama y plano desde un solo lugar", { exact: true }).locator("xpath=..");

assert((await panelDirectorio.getByText(/Tableros, circuitos y equipos \(3\)/).count()) === 1, "Sección 'Tableros, circuitos y equipos' muestra el total correcto (1 tablero + 1 circuito + 1 equipo)");
assert((await panelDirectorio.getByText(/Diagrama unifilar \(1\)/).count()) === 1, "Sección 'Diagrama unifilar' muestra 1 nodo");
assert((await panelDirectorio.getByText(/^Plano \(3\)/).count()) === 1, "Sección 'Plano' muestra el total correcto (1 ambiente + 1 ruta + 1 equipo)");

assert((await panelDirectorio.locator('input[value="Tablero principal"]').count()) === 1, "El tablero creado aparece editable en el árbol");
assert((await panelDirectorio.locator('input[value="Iluminación cocina"]').count()) === 1, "El circuito creado aparece editable, anidado bajo su tablero");
assert((await panelDirectorio.locator('input[value="Lámpara LED"]').count()) === 1, "El equipo creado aparece editable, anidado bajo su circuito");
assert((await panelDirectorio.locator('input[value="RED"]').count()) === 1, "El nodo del diagrama aparece editable en su sección");
assert((await panelDirectorio.locator('input[value="Cocina"]').count()) === 1, "El ambiente del plano aparece editable en su sub-sección");
assert((await panelDirectorio.locator('input[value="Alimentador cocina"]').count()) === 1, "La ruta de conductor aparece editable en su sub-sección");

// --- 4. Editar inline desde Directorio y confirmar que se refleja en la pestaña original ---
await panelDirectorio.locator('input[value="Tablero principal"]').fill("TD-1 Principal");
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(200);
assert((await page.getByText("TD-1 Principal").count()) >= 1, "Renombrar el tablero desde Directorio se refleja en la pestaña Tableros");

await page.getByRole("button", { name: "Directorio", exact: true }).click();
await page.waitForTimeout(200);
// Nombre corto a propósito: DiagramaUnifilar.jsx trunca el <text> del
// nodo a 16 caracteres (con "…"), así que un nombre más largo nunca
// aparecería completo — no es un bug, es cómo se ve el SVG.
await panelDirectorio.locator('input[value="RED"]').fill("ACOMETIDA");
await page.waitForTimeout(150);
// Volvemos a pasar por "Esquemas" porque venimos de la pestaña Directorio
// (Diagrama unifilar y Plano viven agrupados bajo "Esquemas", ver SubTabs.jsx).
await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Diagrama unifilar", exact: true }).click();
await page.waitForTimeout(200);
assert((await page.locator("svg text", { hasText: "ACOMETIDA" }).count()) >= 1, "Renombrar el nodo desde Directorio se refleja en el Diagrama unifilar");

// --- 5. Búsqueda filtra el árbol y mantiene visibles los ancestros ---
await page.getByRole("button", { name: "Directorio", exact: true }).click();
await page.waitForTimeout(200);
await panelDirectorio.getByPlaceholder("Buscar por etiqueta, nombre o función…").fill("Lámpara");
await page.waitForTimeout(150);
assert((await panelDirectorio.locator('input[value="Lámpara LED"]').count()) === 1, "La búsqueda encuentra el equipo por nombre");
assert((await panelDirectorio.locator('input[value="TD-1 Principal"]').count()) === 1, "El tablero ancestro sigue visible aunque no coincida él mismo, para dar contexto");
assert((await panelDirectorio.locator('input[value="RED"]').count()) === 0, "La búsqueda no muestra nodos del diagrama que no coinciden (RED ya no está, se renombró)");
await panelDirectorio.getByPlaceholder("Buscar por etiqueta, nombre o función…").fill("");
await page.waitForTimeout(150);

// --- 6. Plegar una sección oculta su contenido ---
const tituloPlano = panelDirectorio.getByText(/^Plano \(3\)/);
await tituloPlano.locator("xpath=preceding-sibling::button").click();
await page.waitForTimeout(150);
assert((await panelDirectorio.locator('input[value="Cocina"]').count()) === 0, "Plegar la sección 'Plano' oculta su contenido (el ambiente ya no está en el DOM)");
await tituloPlano.locator("xpath=preceding-sibling::button").click();
await page.waitForTimeout(150);
assert((await panelDirectorio.locator('input[value="Cocina"]').count()) === 1, "Desplegarla de nuevo lo vuelve a mostrar");

// --- 7. Eliminar un marcador de equipo del plano desde Directorio ---
const eliminarEquipoPlano = panelDirectorio.locator('button[aria-label="Eliminar equipo del plano"]');
assert((await eliminarEquipoPlano.count()) === 1, "Hay un botón para eliminar el equipo marcado en el plano");
await eliminarEquipoPlano.click();
await page.waitForTimeout(150);
assert((await panelDirectorio.getByText(/Equipos en el plano \(0\)/).count()) === 1, "Eliminar desde Directorio quita el marcador (Equipos en el plano baja a 0)");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/directorio_plegable.png", fullPage: true });
await browser.close();
