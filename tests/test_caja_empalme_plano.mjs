// Caja de empalme como marcador de Plano — usuario, 2026-11-24: "son
// como referencia de donde y como se conecta cada cosa en una
// instalación... al menos en instalaciones básicas y avanzadas; en
// industrial y comercial trabajan más con paneles/subpanel/consumidor
// final directo". NO es un concepto eléctrico (sin carga, sin
// breaker, entidadVinculada siempre null) — por eso se agrega como
// marcador "soloPlano" en bibliotecaComponentes.js: debe aparecer
// en el selector de "Colocar equipo" de Plano, pero NO en el
// selector de tipo de nodo del editor de Diagrama unifilar.
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

await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);
await page.locator('input[type="file"][accept="image/*,application/pdf"]').setInputFiles(DIR + "fixtures/plano_test.png");
await page.waitForTimeout(400);

// --- 1. Sin calibrar: colocar un equipo avisa en vez de fallar en silencio ---
await page.getByRole("button", { name: "Colocar equipo", exact: true }).click();
await page.waitForTimeout(150);
await page.locator("select").nth(2).selectOption({ label: "Caja de empalme" });
let p = await puntoPantallaDesdeImagen({ x: 400, y: 300 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);
assert((await page.getByText(/Calibrá el plano primero/).count()) >= 1, "Sin calibrar, colocar equipo avisa en vez de fallar en silencio");
assert((await page.getByText(/Equipos en el plano \(0\)/).count()) >= 1, "No se creó ningún marcador sin calibrar");

// --- 2. Calibrar (400px = 5m) ---
await page.getByRole("button", { name: "Calibrar", exact: true }).click();
await page.waitForTimeout(150);
p = await puntoPantallaDesdeImagen({ x: 100, y: 100 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(100);
p = await puntoPantallaDesdeImagen({ x: 500, y: 100 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(150);
await page.getByPlaceholder("Ej: 5").fill("5");
await page.getByRole("button", { name: "Calibrar", exact: true }).last().click();
await page.waitForTimeout(200);

// --- 3. Colocar la caja de empalme, ya calibrado ---
await page.getByRole("button", { name: "Colocar equipo", exact: true }).click();
await page.waitForTimeout(150);
await page.locator("select").nth(2).selectOption({ label: "Caja de empalme" });
await page.getByPlaceholder("Nombre (opcional)").fill("CE-1 cocina");
await page.waitForTimeout(100);
assert(
  (await page.getByText(/Vincular a/).count()) === 0,
  "No pide vincular a ninguna entidad (correcto — una caja de empalme nunca se vincula, no es un concepto eléctrico)"
);
p = await puntoPantallaDesdeImagen({ x: 400, y: 300 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(300);
assert((await page.getByText(/Equipos en el plano \(1\)/).count()) >= 1, "Se creó 1 marcador de 'Caja de empalme' en el plano");
assert((await page.locator('input[value="CE-1 cocina"]').count()) >= 1, "El nombre ingresado se guardó en el marcador");

// --- 4. NO aparece como tipo de nodo seleccionable en el editor de
//     Diagrama unifilar (soloPlano) — TabsViewPager monta ambos
//     <select> a la vez, hay que acotar al select de cada editor:
//     [0] capas visibles del plano, [1] tipo de nodo del Diagrama,
//     [2] tipo de equipo del Plano. ---
const opcionesDiagrama = await page.locator("select").nth(1).locator("option").allTextContents();
const opcionesPlano = await page.locator("select").nth(2).locator("option").allTextContents();
assert(!opcionesDiagrama.includes("Caja de empalme"), "'Caja de empalme' NO aparece en el selector de tipo del Diagrama unifilar");
assert(opcionesPlano.includes("Caja de empalme"), "'Caja de empalme' SÍ aparece en el selector de tipo de Plano");
assert(opcionesDiagrama.includes("Barra de distribución"), "Un tipo normal (no soloPlano) sigue disponible en el Diagrama — el filtro no se pasó de listo");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await browser.close();
