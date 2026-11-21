import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4336"), { waitUntil: "networkidle" });

const tipos = [
  "Acometida", "Transformador", "Generador", "Banco de baterías", "Panel fotovoltaico",
  "Medidor", "Interruptor principal", "Interruptor termomagnético", "Interruptor diferencial",
  "Protector contra sobretensiones (SPD)", "Fusible", "Tablero eléctrico", "Barra de distribución",
  "Contacto (tomacorriente)", "Interruptor", "Luminaria", "Motor", "Carga especial",
  "Inversor", "Variador de frecuencia", "PLC", "Relé", "Contactor", "Bobina", "Sensor",
];

const selectTipo = page.locator("select").filter({ has: page.locator('option:has-text("Acometida")') });
const botonAgregar = page.getByRole("button", { name: "+ Agregar", exact: true });

for (const tipo of tipos) {
  await selectTipo.selectOption({ label: tipo });
  await botonAgregar.click();
}

const cantidadNodos = await page.locator("svg g").count();
console.log(`Nodos creados: ${cantidadNodos} (esperado ${tipos.length})`);

// Verificar que cada nodo tiene al menos un elemento SVG de dibujo (no vacío / símbolo genérico de fallback)
const cantidadPaths = await page.locator("svg path").count();
const cantidadCircles = await page.locator("svg circle").count();
const cantidadLines = await page.locator("svg line").count();
console.log(`Elementos de dibujo totales: ${cantidadPaths} path, ${cantidadCircles} circle, ${cantidadLines} line (todos > 0 esperado)`);

console.log("\nErrores de página:", errores);
await page.screenshot({ path: DIR + "tmp/todos_los_simbolos.png", fullPage: true });
await browser.close();
