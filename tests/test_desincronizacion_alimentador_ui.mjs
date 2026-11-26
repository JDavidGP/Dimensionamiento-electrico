// Advertencia de desincronización en el alimentador de un Tablero —
// usuario, 2026-11-26, orden de prioridad explícito: "...luego
// alimentador de un tablero sin la advertencia de sincronización...".
// `desincronizacionRutas` (useCircuitos.js) ya existía y ya funcionaba
// para "Distancia (m)" de un circuito (TablaResultados.jsx) — el mismo
// cálculo trae también entradas con entidadTipo "tablero" (para
// "Longitud alimentador"), pero nadie las leía: PanelTableros.jsx no
// recibía la prop ni dibujaba nada. Esta prueba confirma la misma
// mecánica, ahora conectada, para un tablero.
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

// El campo "Distancia de la fuente de energía (m)" solo se muestra fuera
// de Residencial básico (ver TIPOS_INSTALACION, constantes.js) — mismo
// paso que ya usan test_transformador_gate.mjs/test_edicion_tablero.mjs.
await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Comercial / Industrial", exact: true }).click();
await page.waitForTimeout(150);

// --- 1. Crear un tablero (para que exista como candidato a vincular) ---
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.waitForTimeout(150);
await page.locator("label:has-text('Nombre del tablero')").locator("..").locator("input").fill("Tablero plano");
await page.locator("label:has-text('Distancia de la fuente de energía')").locator("..").locator("input").fill("1");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(200);

assert((await page.getByText(/desincronizada/).count()) === 0, "Sin ninguna ruta vinculada todavía, no hay nada que avisar como desincronizado");

// --- 2. Ir al Plano, cargar imagen, calibrar y trazar un conductor recto de 5m ---
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
await panelPlano.getByPlaceholder("Ej: 60").fill("32"); // 1600px -> 0.02 m/px
await panelPlano.getByRole("button", { name: "Calibrar", exact: true }).last().click();
await page.waitForTimeout(200);

// Conductor recto de (100,300) a (350,300): 250px * 0.02 m/px = 5m exactos, sin cruzar ninguna pared.
await panelPlano.getByRole("button", { name: "Trazar conductor", exact: true }).click();
await page.waitForTimeout(100);
await click({ x: 100, y: 300 });
await click({ x: 350, y: 300 });
await panelPlano.getByRole("button", { name: /Terminar ruta/ }).click();
await page.waitForTimeout(200);

// --- 3. Vincular la ruta al TABLERO recién creado, y sincronizar una vez ---
await panelPlano.locator("select").filter({ hasText: "Vincular a" }).selectOption({ label: "Tablero plano" });
await page.waitForTimeout(150);
assert(await panelPlano.getByText(/Distancia actual: 1\.00 m/).isVisible(), "Antes de aplicar nada, muestra la longitud ACTUAL del tablero (1m, la que pusimos al crearlo)");

await panelPlano.getByRole("button", { name: /Usar esta longitud/ }).click();
await page.waitForTimeout(200);
assert(await panelPlano.getByText(/Distancia actual: 4\.9\d m/).isVisible(), "Tras 'Usar esta longitud', ya refleja los ~5m de la ruta trazada");

// --- 4. Ir a Tableros: recién sincronizado, SIN advertencia ---
// (el acordeón del tablero ya quedó expandido solo al crearlo — ver
// "lo abre de una, para ver que se creó bien" en abrirCreacion/alGuardar
// — y los paneles quedan siempre montados entre pestañas, así que sigue
// expandido; no hace falta, y NO hay que, tocarlo de nuevo acá: sería
// un toggle que lo cerraría.)
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);
assert((await page.getByText(/desincronizada/).count()) === 0, "Recién sincronizado con 'Usar esta longitud', no hay advertencia");

// --- 5. Editar el campo a mano a un valor distinto -> provoca la desincronización ---
await page.getByRole("button", { name: "Editar tablero Tablero plano" }).click();
await page.waitForTimeout(150);
await page.locator("label:has-text('Distancia de la fuente de energía')").locator("..").locator("input").fill("12");
await page.getByRole("button", { name: "Guardar cambios" }).click();
await page.waitForTimeout(200);

const avisoTexto = await page.getByText(/desincronizada/).textContent();
assert(/12\.00m/.test(avisoTexto), `El aviso muestra el valor actual editado a mano, 12m (real: '${avisoTexto}')`);
assert(/4\.9\dm/.test(avisoTexto), `...y el valor esperado según la ruta trazada, ~5m (real: '${avisoTexto}')`);

// --- 6. Volver al Plano y re-sincronizar: la advertencia desaparece sola ---
await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);
await panelPlano.getByRole("button", { name: /Usar esta longitud/ }).click();
await page.waitForTimeout(200);

await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);
assert((await page.getByText(/desincronizada/).count()) === 0, "Tras volver a sincronizar desde el Plano, la advertencia desaparece sola");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await browser.close();
