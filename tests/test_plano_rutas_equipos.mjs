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

async function puntoPantallaDesdeImagen(puntoImagen) {
  const svg = page.locator("svg").last();
  const box = await svg.boundingBox();
  const transformAttr = await page.locator("svg > g").last().getAttribute("transform");
  const m = transformAttr.match(/translate\(([-\d.]+),([-\d.]+)\) scale\(([-\d.]+)\)/);
  const panX = parseFloat(m[1]), panY = parseFloat(m[2]), zoom = parseFloat(m[3]);
  return { x: box.x + puntoImagen.x * zoom + panX, y: box.y + puntoImagen.y * zoom + panY, zoom };
}

// --- 0. Crear un tablero real primero (para probar el vínculo entidad <-> marcador de equipo) ---
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: "+ Nuevo tablero", exact: true }).click();
await page.waitForTimeout(150);
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("TD-PRUEBA-PLANO");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(200);

// --- 1. Ir a Plano, cargar imagen, calibrar (400px = 5m, igual que test_plano.mjs) ---
// Diagrama unifilar y Plano viven agrupados bajo "Esquemas" (ver SubTabs.jsx).
await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);

// El Directorio (pestaña nueva, siguiente ronda) TAMBIÉN muestra
// "Rutas de conductor (N)"/"Equipos en el plano (N)" en sus propias
// sub-secciones — TabsViewPager mantiene las dos pestañas montadas a
// la vez. Acotamos a la propia caja de PlanoInteligente.jsx ("Plano
// inteligente" es un texto único de ESE panel) para no chocar.
const panelPlano = page.getByText("Plano inteligente", { exact: true }).locator("xpath=../../..");

await page.locator('input[type="file"][accept="image/*,application/pdf"]').setInputFiles(
  DIR + "fixtures/plano_test.png"
);
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

// =========== PARTE 1: ruta de conductor ===========
await page.getByRole("button", { name: "Trazar conductor", exact: true }).click();
await page.waitForTimeout(150);

// Recorrido en L: (100,100) -> (500,100) -> (500,400) de imagen.
// En metros (escala 0.0125 m/px): 400px=5m, luego 300px=3.75m -> total 8.75m.
const tramos = [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 400 }];
for (const punto of tramos) {
  const pp = await puntoPantallaDesdeImagen(punto);
  await page.mouse.click(pp.x, pp.y);
  await page.waitForTimeout(150);
}

page.once("dialog", (d) => d.accept("Alimentador cocina"));
await page.getByRole("button", { name: /Terminar ruta/ }).click();
await page.waitForTimeout(250);

assert((await panelPlano.getByText("Rutas de conductor (1)").count()) === 1, "Se registró 1 ruta de conductor al terminarla");
assert((await panelPlano.locator('input[value="Alimentador cocina"]').count()) === 1, "El nombre ingresado en el prompt se usó para la ruta");
const textoLongitud = await page.locator("div", { hasText: /longitud/ }).last().textContent();
const matchLongitud = textoLongitud.match(/longitud trazada ([\d.]+) m/);
const longitudNum = parseFloat(matchLongitud[1]);
assert(Math.abs(longitudNum - 8.75) < 0.1, `Longitud de la ruta ≈ 5m + 3.75m = 8.75 m (real: ${longitudNum})`);

// =========== PARTE 2: equipo ubicado + vínculo a entidad real ===========
await page.getByRole("button", { name: "Colocar equipo", exact: true }).click();
await page.waitForTimeout(150);

// TabsViewPager mantiene TODAS las pestañas montadas a la vez (ver la
// nota en App.jsx/TabsViewPager.jsx) — hay <select> de otras pestañas
// en el DOM al mismo tiempo. Acotamos la búsqueda a la barra de
// herramientas de "Colocar equipo" usando el input "Nombre (opcional)"
// (único de esta barra) como punto de referencia.
const barraEquipo = page.locator('input[placeholder="Nombre (opcional)"]').locator("xpath=..");

// Tipo por defecto es el primero del catálogo (categoría "fuente" -> "acometida").
// Elegimos explícitamente "Tablero eléctrico" (vinculable a un tablero real).
await barraEquipo.locator("select").first().selectOption("tablero_electrico");
await page.waitForTimeout(100);
assert((await barraEquipo.locator("select").count()) === 2, "Al elegir un tipo vinculable aparece el select de 'Vincular a'");

const pEquipo = await puntoPantallaDesdeImagen({ x: 300, y: 250 });
await page.mouse.click(pEquipo.x, pEquipo.y);
await page.waitForTimeout(250);

assert((await panelPlano.getByText("Equipos en el plano (1)").count()) === 1, "Se registró 1 equipo marcado en el plano");
assert((await page.getByText("Tablero eléctrico").count()) >= 1, "El marcador muestra el nombre del tipo de componente (catálogo del diagrama unifilar, reutilizado)");

// Vincular el marcador recién creado al tablero real desde el panel lateral.
const selectVinculo = page.locator("div", { hasText: "Equipos en el plano" }).locator("select").last();
await selectVinculo.selectOption({ label: "TD-PRUEBA-PLANO" });
await page.waitForTimeout(200);
assert((await selectVinculo.locator("option:checked").textContent()).includes("TD-PRUEBA-PLANO"), "El marcador quedó vinculado al tablero real creado al inicio");

// =========== PARTE 3: persistencia (guardar + reabrir) ===========
const [descarga] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "↓ Guardar (.json)" }).click(),
]);
const rutaDescargada = DIR + "tmp/plano_rutas_equipos.json";
await descarga.saveAs(rutaDescargada);
await page.waitForTimeout(200);

await page.reload({ waitUntil: "networkidle" });
await page.locator('input[type="file"][accept="application/json"]').setInputFiles(rutaDescargada);
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);

assert((await panelPlano.getByText("Rutas de conductor (1)").count()) === 1, "La ruta de conductor persiste tras guardar y reabrir el proyecto");
assert((await panelPlano.getByText("Equipos en el plano (1)").count()) === 1, "El equipo marcado persiste tras guardar y reabrir el proyecto");
const textoLongitudTrasReabrir = await page.locator("div", { hasText: /longitud/ }).last().textContent();
assert(textoLongitudTrasReabrir === textoLongitud, `La longitud de la ruta es IDÉNTICA tras reabrir (antes: '${textoLongitud}', después: '${textoLongitudTrasReabrir}')`);
const selectVinculoTrasReabrir = page.locator("div", { hasText: "Equipos en el plano" }).locator("select").last();
assert((await selectVinculoTrasReabrir.locator("option:checked").textContent()).includes("TD-PRUEBA-PLANO"), "El vínculo al tablero real persiste tras reabrir el proyecto");

// =========== PARTE 4: eliminar un marcador en modo "Borrar" ===========
await page.getByRole("button", { name: "Borrar", exact: true }).click();
await page.waitForTimeout(150);
const pEquipoBorrar = await puntoPantallaDesdeImagen({ x: 300, y: 250 });
await page.mouse.click(pEquipoBorrar.x, pEquipoBorrar.y);
await page.waitForTimeout(250);
assert((await panelPlano.getByText("Equipos en el plano (0)").count()) === 1, "El marcador de equipo se elimina al clickearlo en modo Borrar");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/plano_rutas_equipos.png", fullPage: true });
await browser.close();
