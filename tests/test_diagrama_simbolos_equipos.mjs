import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

// Símbolos distintos por tipo de control/carga en el diagrama unifilar
// (usuario, 2026-11-23): "conmutada" (2+ puntos de control) y
// "cascada" (cadena de conmutados, extremos sencillos) son variantes
// SOLO visuales/documentales de luminaria — ningún cálculo cambia
// según cuál sea. Esta prueba cubre el camino de "Importación de
// equipos por texto" (el otro camino, PDF+IA, ya lo cubre
// test_importar_pdf_ia.mjs): crea un tablero y un circuito a mano,
// importa equipos de distintos tipos por texto, y confirma que el
// diagrama se arma solo CON el símbolo correcto por palabra clave —
// reusando el nodo del tablero ya existente, sin duplicarlo.

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4355"), { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

// --- 1. Tablero + circuito a mano (el camino de "equipos por texto"
//     SOLO agrega equipos, nunca crea tableros/circuitos) ---
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("TD1");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(300);

await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Ej: Iluminación cocina").fill("Iluminación");
await page.getByPlaceholder("Ej: TD1-C3").fill("C1");
await page.locator("label", { hasText: "Distancia (m)" }).locator("xpath=following-sibling::input[1]").fill("0");
await page.getByRole("button", { name: "+ Crear circuito" }).click();
await page.waitForTimeout(300);
await page.getByLabel("Tablero de Iluminación").selectOption({ label: "TD1" });
await page.waitForTimeout(200);

// --- 2. Importar 4 equipos de tipos distintos por texto: sencillo
//     (default), conmutada, cascada, toma — un símbolo distinto cada
//     uno, elegido por palabra clave ---
await page.getByText("¿Preferís pegar una lista? Importar equipos por texto").click();
await page.waitForTimeout(150);
await page.locator("textarea").fill(
  "C1\n7 Luz interruptor sencillo 60W\n6 Luz conmutada 60W\n4 Luz cascada 60W\n2 Toma cocina 100W"
);
await page.getByRole("button", { name: "Previsualizar", exact: true }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: /Importar \d+ equipos?/ }).click();
await page.waitForTimeout(300);

// --- 3. El diagrama se arma solo, con el símbolo correcto por tipo,
//     reusando el nodo del tablero (uno solo, no uno por equipo) ---
await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Diagrama unifilar", exact: true }).click();
await page.waitForTimeout(300);

const svgDiagrama = page.locator("svg").last();
assert((await svgDiagrama.getByText("Acometida").count()) === 1, "Un solo nodo Acometida (no uno por equipo)");
assert((await svgDiagrama.getByText(/^TD1$/).count()) === 1, "Un solo nodo de tablero (reusado, no duplicado por cada equipo)");
assert((await svgDiagrama.getByText(/Luminaria \(conmutada\)/).count()) === 1, "El equipo 'conmutada' usa el símbolo de luminaria conmutada");
assert((await svgDiagrama.getByText(/Luminaria \(cascada\)/).count()) === 1, "El equipo 'cascada' usa el símbolo de luminaria cascada");
assert((await svgDiagrama.getByText(/^Luminaria · vinculado$/).count()) === 1, "El equipo 'interruptor sencillo' usa el símbolo de luminaria común (sin variante)");
assert((await svgDiagrama.getByText(/^Contacto \(tomacorriente\)/).count()) === 1, "El equipo 'Toma cocina' usa el símbolo de tomacorriente, no uno genérico");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/diagrama_simbolos_equipos.png", fullPage: true });
await browser.close();
