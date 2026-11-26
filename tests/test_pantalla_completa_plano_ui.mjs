// Pantalla completa + menú de herramientas colapsable en el Plano —
// usuario, 2026-11-26, "al entrar en plano y entrar a editar se
// expande a pantalla completa... los botones quedan agrupados en un
// menú que tocas para expandir o retraer" (confirmó Android). Dos
// capas independientes: (1) un modo CSS propio (position:fixed sobre
// el viewport) que SIEMPRE funciona, es la fuente de verdad del
// layout; (2) un intento best-effort de la Fullscreen API real +
// orientación horizontal, que en un entorno headless de CI puede
// fallar o no estar disponible — por eso esta prueba verifica la capa
// (1) (siempre determinística) y solo confirma que intentar la capa
// (2) nunca tira un error de página.
import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 420, height: 800 } }); // tamaño de teléfono, a propósito
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto(process.env.BASE_URL || "http://localhost:4343", { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);

const botonPantallaCompleta = page.getByRole("button", { name: "⛶ Pantalla completa", exact: true });
assert((await botonPantallaCompleta.count()) === 0, "Sin plano cargado, el botón de pantalla completa ni aparece (nada que maximizar)");

await page.locator('input[type="file"][accept="image/*,application/pdf"]').setInputFiles(DIR + "fixtures/plano_test.png");
await page.waitForTimeout(400);

async function puntoPantallaDesdeImagen(puntoImagen) {
  const svg = page.locator("svg").last();
  await svg.scrollIntoViewIfNeeded(); // viewport de teléfono (420px ancho) — el lienzo queda bien abajo de la barra de 17 modos envuelta en varias líneas, hay que desplazarse hasta él antes de clickear coordenadas absolutas.
  const box = await svg.boundingBox();
  const transformAttr = await page.locator("svg > g").last().getAttribute("transform");
  const m = transformAttr.match(/translate\(([-\d.]+),([-\d.]+)\) scale\(([-\d.]+)\)/);
  const panX = parseFloat(m[1]), panY = parseFloat(m[2]), zoom = parseFloat(m[3]);
  return { x: box.x + puntoImagen.x * zoom + panX, y: box.y + puntoImagen.y * zoom + panY };
}

// Calibrar primero — sin escala, "Trazar pared" no crea ningún nodo
// (los nodos viven en espacio MODELO/metros, necesitan la conversión).
await page.getByRole("button", { name: "Calibrar", exact: true }).click();
await page.waitForTimeout(150);
let pCal = await puntoPantallaDesdeImagen({ x: 100, y: 100 });
await page.mouse.click(pCal.x, pCal.y);
await page.waitForTimeout(100);
pCal = await puntoPantallaDesdeImagen({ x: 500, y: 100 });
await page.mouse.click(pCal.x, pCal.y);
await page.waitForTimeout(150);
await page.getByPlaceholder("Ej: 5").fill("5");
await page.getByRole("button", { name: "Calibrar", exact: true }).last().click();
await page.waitForTimeout(200);

const planoGrid = page.locator(".plano-grid");
const svgCanvas = page.locator("svg").last().locator("xpath=..");

// --- 1. Con plano cargado, el botón aparece; el modo FAB de herramientas NO (todavía no estamos en pantalla completa) ---
assert(await botonPantallaCompleta.isVisible(), "Con un plano cargado, 'Pantalla completa' es visible");
assert((await page.getByRole("button", { name: /herramientas/i }).count()) === 0, "Fuera de pantalla completa, el botón de Herramientas (FAB) ni existe — la barra de modos siempre está visible normal");

const alturaCanvasAntes = await svgCanvas.evaluate((el) => el.style.height);
assert(alturaCanvasAntes === "480px", `Antes de pantalla completa, el lienzo usa la altura fija de siempre (real: '${alturaCanvasAntes}')`);

// --- 2. Entrar en pantalla completa: el contenedor pasa a position:fixed cubriendo el viewport, el lienzo pide más alto, y el botón cambia a "Salir" ---
await botonPantallaCompleta.click();
await page.waitForTimeout(150);

const posicionTrasEntrar = await planoGrid.evaluate((el) => getComputedStyle(el).position);
assert(posicionTrasEntrar === "fixed", `Al entrar en pantalla completa, el contenedor del Plano pasa a position:fixed (real: '${posicionTrasEntrar}')`);

const botonSalir = page.getByRole("button", { name: "⤡ Salir", exact: true });
assert(await botonSalir.isVisible(), "El botón ahora dice 'Salir' (atajo, corto a propósito para que quepa flotando en la esquina)");
assert((await botonPantallaCompleta.count()) === 0, "El botón de 'entrar' ya no existe mientras está en pantalla completa (es el mismo botón, cambia de texto/acción)");

const alturaCanvasDespues = await svgCanvas.evaluate((el) => el.style.height);
assert(alturaCanvasDespues.includes("vh") && alturaCanvasDespues !== "480px", `En pantalla completa, el lienzo pide una altura basada en el viewport, no la fija de 480px (real: '${alturaCanvasDespues}')`);

// --- 3. El FAB "Herramientas" aparece, arranca EXPANDIDO (el selector de modos sigue visible) ---
const botonHerramientas = page.getByRole("button", { name: /herramientas/i });
assert(await botonHerramientas.isVisible(), "En pantalla completa aparece el botón de Herramientas (FAB)");
const botonTrazarPared = page.getByRole("button", { name: "Trazar pared", exact: true });
assert(await botonTrazarPared.isVisible(), "Arranca EXPANDIDO — el selector de modos (ej. 'Trazar pared') sigue visible de entrada");

// --- 4. Tocar el FAB retrae el menú — el selector de modos desaparece, pero el modo activo NO cambia ---
await page.getByRole("button", { name: "Trazar pared", exact: true }).click();
await page.waitForTimeout(100);
await botonHerramientas.click();
await page.waitForTimeout(100);
assert(!(await botonTrazarPared.isVisible()), "Al tocar el FAB, el selector de modos se esconde (display:none)");

// El lienzo sigue ahí y sigue siendo clickeable para trazar en modo "pared" aunque el menú esté oculto — confirma que ocultar el menú no afecta la funcionalidad del lienzo.
let p = await puntoPantallaDesdeImagen({ x: 150, y: 250 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(150);
const circulosTrasClick = await page.locator("svg > g circle").count();
assert(circulosTrasClick >= 1, "Con el menú retraído, el lienzo sigue funcionando — el click en modo 'Trazar pared' creó un nodo igual");

// --- 5. Reabrir el menú lo vuelve a mostrar ---
await botonHerramientas.click();
await page.waitForTimeout(100);
assert(await botonTrazarPared.isVisible(), "Tocar el FAB de nuevo re-expande el menú");

// --- 6. Salir de pantalla completa: todo vuelve al estado normal ---
await botonSalir.click();
await page.waitForTimeout(150);
const posicionTrasSalir = await planoGrid.evaluate((el) => getComputedStyle(el).position);
assert(posicionTrasSalir !== "fixed", `Al salir, el contenedor deja de ser position:fixed (real: '${posicionTrasSalir}')`);
assert(await botonPantallaCompleta.isVisible(), "El botón vuelve a decir 'Pantalla completa'");
assert((await page.getByRole("button", { name: /herramientas/i }).count()) === 0, "El FAB de Herramientas desaparece al salir — la barra de modos vuelve a su comportamiento normal (siempre visible)");
const alturaCanvasFinal = await svgCanvas.evaluate((el) => el.style.height);
assert(alturaCanvasFinal === "480px", "El lienzo vuelve a su altura fija de siempre al salir de pantalla completa");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo (incluido el intento best-effort de Fullscreen API/orientación real, que en este entorno headless puede fallar silenciosamente sin romper nada)");

await browser.close();
