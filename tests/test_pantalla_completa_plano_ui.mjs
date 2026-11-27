// Pantalla completa + menú de herramientas por categorías en el Plano
// — usuario, 2026-11-26, "al entrar en plano y entrar a editar se
// expande a pantalla completa... los botones quedan agrupados en un
// menú que tocas para expandir o retraer" (confirmó Android), y luego,
// probándolo en el celular real: "el botón de pantalla completa
// debería ir dentro del lienzo en una esquina... cuando toque el menú
// despliega un menú que contenga apartados por ejemplo ambiente lo
// tocas y muestra todos los botones relacionado con esa función".
//
// Dos capas independientes para pantalla completa: (1) un modo CSS
// propio (position:fixed sobre el viewport) que SIEMPRE funciona, es
// la fuente de verdad del layout; (2) un intento best-effort de la
// Fullscreen API real + orientación horizontal, que en un entorno
// headless de CI puede fallar o no estar disponible — por eso esta
// prueba verifica la capa (1) (siempre determinística) y solo
// confirma que intentar la capa (2) nunca tira un error de página.
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

// El botón vive DENTRO del lienzo (como el de un reproductor de
// video), no en el panel de controles — se busca dentro del
// contenedor relativo que PlanoCanvas.jsx arma para sus propios
// overlays (el mismo que ya usan los botones de zoom −/Ajustar/+).
const contenedorLienzo = page.locator("svg").last().locator("xpath=../..");
const botonPantallaCompleta = contenedorLienzo.getByRole("button", { name: "⛶", exact: true });
assert((await botonPantallaCompleta.count()) === 0, "Sin plano cargado, el botón de pantalla completa ni aparece (nada que maximizar)");

await page.locator('input[type="file"][accept="image/*,application/pdf"]').setInputFiles(DIR + "fixtures/plano_test.png");
await page.waitForTimeout(400);

async function puntoPantallaDesdeImagen(puntoImagen) {
  const svg = page.locator("svg").last();
  await svg.scrollIntoViewIfNeeded(); // viewport de teléfono (420px ancho) — el lienzo queda bien abajo de la barra de modos, hay que desplazarse hasta él antes de clickear coordenadas absolutas.
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

// --- 1. Con plano cargado, el botón del lienzo aparece; el FAB de herramientas NO (todavía no estamos en pantalla completa) ---
assert(await botonPantallaCompleta.isVisible(), "Con un plano cargado, el botón '⛶' es visible DENTRO del lienzo");
assert((await page.getByRole("button", { name: /herramientas/i }).count()) === 0, "Fuera de pantalla completa, el FAB de Herramientas ni existe — la barra de modos siempre está visible normal");

const alturaCanvasAntes = await svgCanvas.evaluate((el) => el.style.height);
assert(alturaCanvasAntes === "480px", `Antes de pantalla completa, el lienzo usa la altura fija de siempre (real: '${alturaCanvasAntes}')`);

// --- 2. Entrar en pantalla completa: el contenedor pasa a position:fixed cubriendo el viewport, el lienzo pide más alto, y el botón del lienzo cambia a "⤡" ---
await botonPantallaCompleta.click();
await page.waitForTimeout(150);

const posicionTrasEntrar = await planoGrid.evaluate((el) => getComputedStyle(el).position);
assert(posicionTrasEntrar === "fixed", `Al entrar en pantalla completa, el contenedor del Plano pasa a position:fixed (real: '${posicionTrasEntrar}')`);

const botonSalir = contenedorLienzo.getByRole("button", { name: "⤡", exact: true });
assert(await botonSalir.isVisible(), "El botón del lienzo ahora muestra '⤡' (salir)");
assert((await botonPantallaCompleta.count()) === 0, "El botón '⛶' (entrar) ya no existe mientras está en pantalla completa — es el MISMO botón, cambia de ícono/acción");

const alturaCanvasDespues = await svgCanvas.evaluate((el) => el.style.height);
assert(alturaCanvasDespues.includes("vh") && alturaCanvasDespues !== "480px", `En pantalla completa, el lienzo pide una altura basada en el viewport, no la fija de 480px (real: '${alturaCanvasDespues}')`);

// --- 2b. Bug real reportado por el usuario (2026-11-26/27): una
//     acción SIN relación con pantalla completa (ej. "Deshacer") hacía
//     que el navegador saliera de la Fullscreen API real por su
//     cuenta, y la app confiaba ciegamente en ESE evento para colapsar
//     TODO el modo CSS con él — perdiendo el lienzo grande y el menú
//     colapsado en medio de una edición, sin que el usuario lo pidiera.
//     Simula exactamente eso: el navegador sale de la Fullscreen API
//     real por su cuenta (document.fullscreenElement se vuelve null,
//     sin pasar por el botón "Salir") — el modo CSS (position:fixed,
//     el botón sigue en "⤡") NO debe colapsarse solo.
await page.evaluate(() => document.dispatchEvent(new Event("fullscreenchange")));
await page.waitForTimeout(150);
const posicionTrasFullscreenchangeExterno = await planoGrid.evaluate((el) => getComputedStyle(el).position);
assert(
  posicionTrasFullscreenchangeExterno === "fixed",
  `Un 'fullscreenchange' externo (el navegador salió de la Fullscreen API real por su cuenta) NO colapsa el modo CSS — solo el botón "⤡ Salir" explícito lo hace (real: '${posicionTrasFullscreenchangeExterno}')`
);
assert(await botonSalir.isVisible(), "El botón del lienzo sigue mostrando '⤡' (sigue en modo pantalla completa) tras el 'fullscreenchange' externo");

// --- 3. El FAB "Herramientas" aparece, arranca EXPANDIDO — pero eso ahora
//     muestra las 5 CATEGORÍAS (chips), no los 17 botones sueltos de una. ---
const botonHerramientas = page.getByRole("button", { name: /herramientas/i });
assert(await botonHerramientas.isVisible(), "En pantalla completa aparece el FAB de Herramientas");
const chipParedes = page.getByRole("button", { name: "Paredes y conductores", exact: true });
const chipAmbientes = page.getByRole("button", { name: "Ambientes", exact: true });
const botonTrazarPared = page.getByRole("button", { name: "Trazar pared", exact: true });
assert(await chipParedes.isVisible(), "Arranca EXPANDIDO — se ven las categorías (ej. 'Paredes y conductores') de entrada");
assert((await botonTrazarPared.count()) === 0, "...pero NINGÚN botón de modo individual todavía — hace falta tocar una categoría primero");

// --- 4. Tocar una categoría despliega SOLO sus botones ---
await chipParedes.click();
await page.waitForTimeout(100);
assert(await botonTrazarPared.isVisible(), "Tocar 'Paredes y conductores' despliega 'Trazar pared' (y el resto de esa categoría)");
assert((await page.getByRole("button", { name: "Colocar equipo", exact: true }).count()) === 0, "...pero NO los botones de OTRA categoría (ej. 'Colocar equipo', de Equipos)");

// --- 5. Tocar OTRA categoría cambia cuál está desplegada (no las acumula todas) ---
await chipAmbientes.click();
await page.waitForTimeout(100);
assert((await botonTrazarPared.count()) === 0, "Al abrir 'Ambientes', la categoría anterior ('Paredes y conductores') se cierra sola");
assert((await page.getByRole("button", { name: "Generar ambiente", exact: true }).count()) === 1, "...y aparecen los botones de 'Ambientes' en su lugar");

// --- 6. Tocar la MISMA categoría de nuevo la cierra (toggle) ---
await chipAmbientes.click();
await page.waitForTimeout(100);
assert((await page.getByRole("button", { name: "Generar ambiente", exact: true }).count()) === 0, "Tocar la misma categoría de nuevo la cierra");

// --- 7. Elegir un modo real (dentro de una categoría) sigue funcionando igual que siempre ---
await chipParedes.click();
await page.waitForTimeout(100);
await botonTrazarPared.click();
await page.waitForTimeout(100);

// --- 8. Tocar el FAB retrae TODO el drawer (categorías incluidas) — el modo activo NO cambia ---
await botonHerramientas.click();
await page.waitForTimeout(100);
assert(!(await chipParedes.isVisible()), "Al tocar el FAB, hasta las categorías se esconden (display:none)");

// El lienzo sigue ahí y sigue siendo clickeable para trazar en modo "pared" aunque el menú esté oculto — confirma que ocultar el menú no afecta la funcionalidad del lienzo.
let p = await puntoPantallaDesdeImagen({ x: 150, y: 250 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(150);
const circulosTrasClick = await page.locator("svg > g circle").count();
assert(circulosTrasClick >= 1, "Con el drawer retraído, el lienzo sigue funcionando — el click en modo 'Trazar pared' (elegido antes) creó un nodo igual");

// --- 9. Reabrir el FAB vuelve a mostrar las categorías (recuerda cuál estaba abierta: 'Paredes y conductores') ---
await botonHerramientas.click();
await page.waitForTimeout(100);
assert(await chipParedes.isVisible(), "Tocar el FAB de nuevo re-expande el drawer (las categorías)");
assert(await botonTrazarPared.isVisible(), "La categoría que estaba abierta ('Paredes y conductores') sigue abierta — no se resetea sola");

// --- 10. Salir de pantalla completa: todo vuelve al estado normal ---
await botonSalir.click();
await page.waitForTimeout(150);
const posicionTrasSalir = await planoGrid.evaluate((el) => getComputedStyle(el).position);
assert(posicionTrasSalir !== "fixed", `Al salir, el contenedor deja de ser position:fixed (real: '${posicionTrasSalir}')`);
assert(await botonPantallaCompleta.isVisible(), "El botón del lienzo vuelve a mostrar '⛶'");
assert((await page.getByRole("button", { name: /herramientas/i }).count()) === 0, "El FAB de Herramientas desaparece al salir — la barra de modos vuelve a su comportamiento normal (siempre visible, sin categorías)");
const alturaCanvasFinal = await svgCanvas.evaluate((el) => el.style.height);
assert(alturaCanvasFinal === "480px", "El lienzo vuelve a su altura fija de siempre al salir de pantalla completa");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo (incluido el intento best-effort de Fullscreen API/orientación real, que en este entorno headless puede fallar silenciosamente sin romper nada)");

await browser.close();
