// Rutas de conductor huérfanas al eliminar un circuito/tablero —
// auditoría 2026-11-26, "verificá que no hay datos huérfanos". Bug real:
// eliminarCircuito/eliminarTablero (useCircuitos.js) ya liberaban
// marcadores del plano vinculados, pero nunca las rutas de conductor
// (RutaConductorPlano.entidadId) — el <select> "Vincular a" de la ruta
// quedaba apuntando a un id que ya no existe, sin ninguna opción visible
// que coincidiera con su propio value. Verifica en vivo que, tras el
// fix, eliminar el circuito deja esa ruta "— Vincular a (opcional) —"
// de nuevo, igual que un marcador de equipo queda "Sin vincular".
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

// --- 0. Un circuito cualquiera, sin equipos (no hace falta para esta prueba) ---
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Ej: Iluminación cocina").fill("Circuito huérfano test");
await page.locator("label", { hasText: "Distancia (m)" }).locator("xpath=following-sibling::input[1]").fill("10");
await page.getByRole("button", { name: "+ Crear circuito" }).click();
await page.waitForTimeout(200);

// --- 1. Plano: imagen + calibración + un tramo de conductor cualquiera ---
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

await page.getByRole("button", { name: "Trazar conductor", exact: true }).click();
await page.waitForTimeout(150);
for (const punto of [{ x: 100, y: 300 }, { x: 300, y: 300 }]) {
  const pp = await puntoPantallaDesdeImagen(punto);
  await page.mouse.click(pp.x, pp.y);
  await page.waitForTimeout(150);
}
page.once("dialog", (d) => d.accept("Ruta a vincular"));
await page.getByRole("button", { name: /Terminar ruta/ }).click();
await page.waitForTimeout(250);
assert((await panelPlano.getByText("Rutas de conductor (1)").count()) === 1, "La ruta se trazó");

// --- 2. Vincularla al circuito ---
const selectVincular = panelPlano.locator("select").filter({ has: page.locator('option:has-text("Vincular a (opcional)")') });
await selectVincular.selectOption({ label: "Circuito huérfano test" });
await page.waitForTimeout(200);
assert((await selectVincular.inputValue()).includes("circuito:"), "La ruta quedó vinculada al circuito (value del select = 'circuito:<id>')");
assert((await panelPlano.getByText(/Distancia actual:/).count()) === 1, "Aparece 'Distancia actual' — el vínculo resolvió a una entidad real");

// --- 3. Eliminar el circuito desde "Circuitos y resultados" ---
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Eliminar circuito Circuito huérfano test", exact: true }).click();
await page.waitForTimeout(200);

// --- 4. De vuelta al Plano: la ruta quedó desvinculada, no apuntando a un id muerto ---
await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);
assert((await panelPlano.getByText("Rutas de conductor (1)").count()) === 1, "La ruta en sí NO se borró (solo se desvincula, mismo criterio que los marcadores)");
assert((await selectVincular.inputValue()) === "", "Tras eliminar el circuito, el select vuelve a '— Vincular a (opcional) —' (antes del fix quedaba con un value sin ninguna opción visible coincidente)");
assert((await panelPlano.getByText(/Distancia actual:/).count()) === 0, "Ya no muestra 'Distancia actual' — no hay entidad real que resolver");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await browser.close();
