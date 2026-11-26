// Layout mobile general, fuera del Plano (usuario, 2026-11-26, orden de
// prioridad explícito: "...layout mobile y el extra de cruce de
// cruce" — ya resuelto el Plano en una ronda anterior). Auditoría en un
// viewport de teléfono (390px) encontró 2 problemas reales, ninguno de
// los cuales producía overflow horizontal visible en la PÁGINA (el
// overflow:hidden de cada panel de TabsViewPager lo ocultaba en
// silencio, sin ninguna barra de scroll ni indicio):
//   1. Las 2 tablas de "Informe técnico" (Circuitos: 9 columnas,
//      Tableros: 8 columnas) nunca entran en un celular angosto —
//      quedaban recortadas en silencio, columnas enteras (Breaker,
//      Caída) invisibles y sin forma de llegar a ellas.
//   2. La fila de 6 pestañas (TabsViewPager.jsx) ya era scrolleable
//      horizontalmente, pero sin ningún indicio visual — se veía
//      "cortada" a mitad de una pestaña, un usuario no tenía forma de
//      saber que hacía falta deslizarla para llegar a "Informe
//      técnico"/"Directorio".
import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // tamaño de teléfono, a propósito
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto(process.env.BASE_URL || "http://localhost:4343", { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

// --- 0. Datos reales (sin esto, "Informe técnico" no dibuja ninguna tabla) ---
await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Comercial / Industrial", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.waitForTimeout(150);
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("Tablero de Prueba");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(200);
await page.getByPlaceholder("Ej: Iluminación cocina").fill("Circuito de prueba");
await page.locator("label", { hasText: "Distancia (m)" }).locator("xpath=following-sibling::input[1]").fill("10");
await page.getByRole("button", { name: "+ Crear circuito" }).click();
await page.waitForTimeout(200);
await page.getByPlaceholder("Ej: Refrigerador").fill("Equipo de prueba");
await page.locator("label", { hasText: "P unitaria (W)" }).locator("xpath=following-sibling::input[1]").fill("1500");
await page.getByRole("button", { name: "+ Agregar equipo" }).click();
await page.waitForTimeout(200);

// --- 1. Las 2 tablas de Informe técnico son genuinamente scrolleables (no solo recortadas) ---
await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Informe técnico", exact: true }).click();
await page.waitForTimeout(300);

const tablas = await page.evaluate(() => {
  const ts = Array.from(document.querySelectorAll("#informe-memoria-tecnica table"));
  return ts.map((t) => {
    const wrapper = t.parentElement;
    return {
      overflowX: getComputedStyle(wrapper).overflowX,
      scrollable: t.scrollWidth > wrapper.clientWidth,
    };
  });
});
assert(tablas.length === 2, `Las 2 tablas (Circuitos, Tableros) están presentes (real: ${tablas.length})`);
for (const [i, t] of tablas.entries()) {
  assert(t.overflowX === "auto", `Tabla ${i + 1}: su envoltorio es overflowX:auto`);
  assert(t.scrollable, `Tabla ${i + 1}: es más ancha que su envoltorio en este celular — genuinamente scrolleable, no solo recortada`);
}

// Scrollear de verdad revela una columna que antes quedaba invisible (Breaker/Caída, las últimas).
await page.evaluate(() => {
  const t = document.querySelectorAll("#informe-memoria-tecnica table")[0];
  t.parentElement.scrollLeft = t.scrollWidth;
});
await page.waitForTimeout(100);
assert(await page.getByText("Breaker", { exact: true }).first().isVisible(), "Tras scrollear la tabla de Circuitos, la columna 'Breaker' (antes invisible) se puede ver");

// --- 2. La fila de pestañas tiene el fundido visual (mask-image) bajo 680px, señalando que hay más para deslizar ---
const infoTabBar = await page.evaluate(() => {
  const bar = document.querySelector(".tabs-viewpager-tabbar");
  const cs = getComputedStyle(bar);
  return {
    mask: cs.maskImage && cs.maskImage !== "none" ? cs.maskImage : cs.webkitMaskImage,
    scrollable: bar.scrollWidth > bar.clientWidth,
  };
});
assert(infoTabBar.scrollable, "La fila de 6 pestañas no entra completa en 390px — overflow real, no solo en teoría");
assert(!!infoTabBar.mask && infoTabBar.mask !== "none", `Tiene el fundido (mask-image) aplicado, señalando que hay más pestañas para deslizar (real: '${infoTabBar.mask}')`);

// Sigue siendo alcanzable por click directo (el fundido es solo visual, nunca bloquea la pestaña) — ya lo prueban
// implícitamente los pasos de arriba (se navegó a "Informe técnico" con un click normal), pero se confirma explícito acá.
await page.getByRole("button", { name: "Directorio", exact: true }).click();
await page.waitForTimeout(200);
assert(
  (await page.getByText("Directorio — tableros, diagrama y plano desde un solo lugar", { exact: true }).count()) === 1,
  "'Directorio' (la pestaña más a la derecha) sigue siendo clickeable pese al fundido visual"
);

// --- 3. Desktop (ancho normal): sin el fundido — no hace falta, las 6 pestañas ya entran ---
await page.setViewportSize({ width: 1280, height: 900 });
await page.waitForTimeout(150);
const anchoTabBar = await page.evaluate(() => {
  const bar = document.querySelector(".tabs-viewpager-tabbar");
  return { scrollable: bar.scrollWidth > bar.clientWidth, mask: getComputedStyle(bar).maskImage };
});
assert(!anchoTabBar.scrollable, "En desktop, las 6 pestañas entran sin overflow");
assert(anchoTabBar.mask === "none" || !anchoTabBar.mask, "En desktop, el fundido no se aplica (la media query es solo bajo 680px)");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await browser.close();
