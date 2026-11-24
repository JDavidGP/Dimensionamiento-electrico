import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4331"), { waitUntil: "networkidle" });

// TabsViewPager monta TODAS las pestañas a la vez — "svg g"/"svg line"
// sin acotar cuentan los de CUALQUIER svg de la página (Plano,
// "Diagrama sobre plano", etc.), no solo los del editor de Diagrama
// unifilar. Se acota al panel propio del editor (rótulo "Diagrama
// unifilar" en mayúsculas, justo antes de su <select> de tipo de nodo
// — mismo patrón ya usado en otras pruebas de Plano/Diagrama).
const panelDiagrama = page.locator("div", { hasText: "Diagrama unifilar" }).filter({ has: page.locator("select") }).first();
const selectTipo = panelDiagrama.locator("select").filter({ has: page.locator('option:has-text("Acometida")') });
const inputNombre = panelDiagrama.getByPlaceholder("Nombre (ej. Q1, TD-01)");
const botonAgregar = panelDiagrama.getByRole("button", { name: "+ Agregar", exact: true });

async function agregarNodo(tipoLabel, nombre) {
  await selectTipo.selectOption({ label: tipoLabel });
  await inputNombre.fill(nombre);
  await botonAgregar.click();
}

// Replicar exactamente el ejemplo del usuario:
// RED -> MEDIDOR -> IGA -> TABLERO TD-1 -> (Q1,Q2,Q3) -> (Luces,Tomas,Motor)
await agregarNodo("Acometida", "RED");
await agregarNodo("Medidor", "MEDIDOR");
await agregarNodo("Interruptor principal", "IGA");
await agregarNodo("Tablero eléctrico", "TABLERO TD-1");
await agregarNodo("Interruptor termomagnético", "Q1");
await agregarNodo("Interruptor termomagnético", "Q2");
await agregarNodo("Interruptor termomagnético", "Q3");
await agregarNodo("Luminaria", "Luces");
await agregarNodo("Contacto (tomacorriente)", "Tomas");
await agregarNodo("Motor", "Motor");

const cantidadNodos = await panelDiagrama.locator("svg g").count();
console.log("Cantidad de nodos creados:", cantidadNodos, "(esperado 10)");

// Modo conectar
await panelDiagrama.getByRole("button", { name: "Conectar", exact: true }).click();

async function conectar(nombreOrigen, nombreDestino) {
  await panelDiagrama.locator("svg text", { hasText: nombreOrigen }).first().click();
  await panelDiagrama.locator("svg text", { hasText: nombreDestino }).first().click();
}

await conectar("RED", "MEDIDOR");
await conectar("MEDIDOR", "IGA");
await conectar("IGA", "TABLERO TD-1");
await conectar("TABLERO TD-1", "Q1");
await conectar("TABLERO TD-1", "Q2");
await conectar("TABLERO TD-1", "Q3");
await conectar("Q1", "Luces");
await conectar("Q2", "Tomas");
await conectar("Q3", "Motor");

const cantidadConexiones = await panelDiagrama.locator("svg line").count();
console.log("Cantidad de conexiones creadas:", cantidadConexiones, "(esperado 9)");

// Intentar una conexión INVÁLIDA: MEDIDOR -> Motor directo (sin protección) debe rechazarse con aviso
await conectar("MEDIDOR", "Motor");
const avisoVisible = await page.getByText(/protección/).isVisible().catch(() => false);
console.log("Aviso de regla rechazada visible (MEDIDOR -> Motor directo):", avisoVisible);
const cantidadConexionesTrasRechazo = await panelDiagrama.locator("svg line").count();
console.log("Cantidad de conexiones tras intento inválido (debe seguir en 9):", cantidadConexionesTrasRechazo);

// Modo mover: arrastrar el nodo RED
await panelDiagrama.getByRole("button", { name: "Mover", exact: true }).click();
const nodoRed = panelDiagrama.locator("svg g").filter({ has: page.locator("text", { hasText: "RED" }) }).first();
const cajaAntes = await nodoRed.boundingBox();
await page.mouse.move(cajaAntes.x + 20, cajaAntes.y + 20);
await page.mouse.down();
await page.mouse.move(cajaAntes.x + 120, cajaAntes.y + 80, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(200);
const cajaDespues = await nodoRed.boundingBox();
console.log("Nodo RED se movió:", cajaAntes.x !== cajaDespues.x || cajaAntes.y !== cajaDespues.y, `(${cajaAntes.x},${cajaAntes.y}) -> (${cajaDespues.x},${cajaDespues.y})`);

// Guardar proyecto y verificar que el diagrama persiste
const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: ".json", exact: true }).click(),
]);
const ruta = await download.path();
const fs = await import("fs");
const json = JSON.parse(fs.readFileSync(ruta, "utf-8"));
console.log("nodosDiagrama guardados:", json.nodosDiagrama.length, "| conexionesDiagrama guardadas:", json.conexionesDiagrama.length);

console.log("\nErrores de página:", errores);
await page.screenshot({ path: DIR + "tmp/diagrama_screenshot.png", fullPage: true });
await browser.close();
