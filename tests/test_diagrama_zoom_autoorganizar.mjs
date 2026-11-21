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

await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Diagrama unifilar", exact: true }).click();
await page.waitForTimeout(300);

// Panel del diagrama (escapa de Plano/InformeTecnico, que ahora comparten
// el mismo formato de transform translate(...) scale(...) en su <g> de
// pan/zoom — ver nota de sesión sobre esto). Se ubica a partir del botón
// "Autoorganizar", que es único de este panel: su 2do ancestro <div> es
// el panel completo (título + barra + lienzo como hermanos).
const panelDiagrama = page.getByRole("button", { name: "⇅ Autoorganizar" }).locator("xpath=ancestor::div[2]");
const svgDiagrama = panelDiagrama.locator("svg").last();
const grupoVista = svgDiagrama.locator("g").first();

async function leerTransformVista() {
  const t = await grupoVista.getAttribute("transform");
  const m = t.match(/translate\(([-\d.]+),([-\d.]+)\) scale\(([-\d.]+)\)/);
  return { panX: parseFloat(m[1]), panY: parseFloat(m[2]), zoom: parseFloat(m[3]) };
}

// --- 1. Vista inicial: zoom 100%, sin pan ---
let v = await leerTransformVista();
assert(v.zoom === 1 && v.panX === 0 && v.panY === 0, `Vista inicial sin zoom/pan (real: ${JSON.stringify(v)})`);

// --- 2. Botón "+": zoom aumenta ---
const botonMas = panelDiagrama.getByRole("button", { name: "+", exact: true });
await botonMas.click();
await page.waitForTimeout(100);
v = await leerTransformVista();
assert(v.zoom > 1, `El botón "+" aumenta el zoom (real: ${v.zoom})`);

// --- 3. Rueda del mouse sobre el lienzo: zoom cambia ---
const zoomTrasBoton = v.zoom;
const box = await svgDiagrama.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.wheel(0, -200); // deltaY negativo = acercar
await page.waitForTimeout(100);
v = await leerTransformVista();
assert(v.zoom > zoomTrasBoton, `La rueda del mouse también hace zoom (antes: ${zoomTrasBoton}, ahora: ${v.zoom})`);

// --- 4. "Restablecer": vuelve a 100%, sin pan ---
await panelDiagrama.getByRole("button", { name: "Restablecer" }).click();
await page.waitForTimeout(100);
v = await leerTransformVista();
assert(v.zoom === 1 && v.panX === 0 && v.panY === 0, "El botón Restablecer vuelve el zoom/pan a su estado inicial");

// --- 5. Agregar 3 nodos: Acometida, Generador, Tablero eléctrico ---
async function agregarNodo(tipo, nombre) {
  await panelDiagrama.locator("select").first().selectOption({ label: tipo });
  await page.getByPlaceholder("Nombre (ej. Q1, TD-01)").fill(nombre);
  await page.getByRole("button", { name: "+ Agregar", exact: true }).click();
  await page.waitForTimeout(150);
}
// "Barra de distribución" acepta entradas ilimitadas — a diferencia de
// un tablero eléctrico (1 sola), necesaria acá para que las DOS
// conexiones (RED->TD1 y GEN->TD1) se acepten y se pueda probar de
// verdad el caso de fusión (dos padres hacia un mismo hijo) en la UI
// real, no solo en la función pura (ver test_autoorganizar.mjs).
await agregarNodo("Acometida", "RED");
await agregarNodo("Generador", "GEN");
await agregarNodo("Barra de distribución", "TD1");

// --- 6. Conectar RED->TD1 y GEN->TD1 (fusión: TD1 depende de los dos) ---
await page.getByRole("button", { name: "Conectar", exact: true }).click();
await page.waitForTimeout(100);
async function clickNodoPorTexto(texto) {
  await panelDiagrama.locator("svg text", { hasText: texto }).first().click();
  await page.waitForTimeout(100);
}
await clickNodoPorTexto("RED");
await clickNodoPorTexto("TD1");
await clickNodoPorTexto("GEN");
await clickNodoPorTexto("TD1");

// --- 7. Arrastrar el lienzo vacío en modo "Mover" desplaza la VISTA (pan), no los nodos ---
await page.getByRole("button", { name: "Mover", exact: true }).click();
await page.waitForTimeout(100);
async function leerPosicionNodo(texto) {
  // .last(): "svg g" matchea tanto el <g> de pan/zoom (ancestro, con
  // translate+scale) como el <g> propio del nodo (descendiente, con
  // translate solo) — ambos "tienen" el texto buscado adentro. El del
  // nodo es el más profundo, por eso aparece último en orden de documento.
  const g = panelDiagrama.locator("svg g").filter({ has: page.locator("text", { hasText: texto }) }).last();
  const t = await g.getAttribute("transform");
  const m = t.match(/translate\(([-\d.]+), ?([-\d.]+)\)/);
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}
const posRedAntes = await leerPosicionNodo("RED");
const boxVacio = await svgDiagrama.boundingBox();
// Centro del lienzo: los 3 nodos quedaron arriba-izquierda (posicionPorDefecto)
// y los controles de zoom flotan abajo-a-la-derecha — el centro está
// libre de ambos.
const cx = boxVacio.x + boxVacio.width / 2;
const cy = boxVacio.y + boxVacio.height / 2;
await page.mouse.move(cx, cy);
await page.mouse.down();
await page.mouse.move(cx - 60, cy - 60, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(100);
v = await leerTransformVista();
assert(v.panX !== 0 || v.panY !== 0, `Arrastrar el lienzo vacío mueve la vista (pan real: ${JSON.stringify(v)})`);
const posRedDespues = await leerPosicionNodo("RED");
assert(posRedDespues.x === posRedAntes.x && posRedDespues.y === posRedAntes.y, "La posición GUARDADA del nodo (espacio modelo) no cambia al mover solo la vista — el pan es puramente visual");

await panelDiagrama.getByRole("button", { name: "Restablecer" }).click();
await page.waitForTimeout(100);

// --- 8. Autoorganizar: RED y GEN quedan en la misma fila, TD1 debajo de ambos ---
await panelDiagrama.getByRole("button", { name: "⇅ Autoorganizar" }).click();
await page.waitForTimeout(150);
const posRed = await leerPosicionNodo("RED");
const posGen = await leerPosicionNodo("GEN");
const posTd1 = await leerPosicionNodo("TD1");
assert(posRed.y === posGen.y, `RED y GEN (ambos sin padre) quedan en la misma fila tras autoorganizar (real: RED.y=${posRed.y}, GEN.y=${posGen.y})`);
assert(posTd1.y > posRed.y && posTd1.y > posGen.y, "TD1 (alimentado por los dos) queda debajo de ambos tras autoorganizar");
assert(posRed.x !== posGen.x, "RED y GEN no se superponen (columnas distintas en la misma fila)");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await page.screenshot({ path: DIR + "tmp/diagrama_zoom_autoorganizar.png", fullPage: true });
await browser.close();
