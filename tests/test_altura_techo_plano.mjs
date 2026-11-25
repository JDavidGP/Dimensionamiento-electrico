// Altura de techo + renombre Alto→Largo en Plano — usuario, 2026-11-25:
// "Ancho y largo sería, alto sería medir del suelo a la viga corona...
// altura es un dato importante para medir los conductores que van hacia
// los tomas o interruptores". Lo que ya existía como "Alto (m)" en el
// marco/ambientes del plano es en realidad el segundo eje HORIZONTAL del
// dibujo en planta (ancho×largo), no la altura real del techo — se
// renombra para no confundirlo con la altura vertical real, que ahora
// se captura por separado (general del plano + override opcional por
// ambiente). Ningún cálculo consume todavía este dato — es solo la
// captura, a la espera de la fase que suma el tramo vertical del
// conductor hacia tomas/interruptores.
import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
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

await page.getByRole("button", { name: "+ Crear plano sin imagen", exact: true }).click();
await page.waitForTimeout(150);
assert((await page.getByText("Largo total (m)", { exact: true }).count()) === 1, "El marco dice 'Largo total (m)', no 'Alto' (evita confundirlo con la altura real del techo)");
assert((await page.getByText("Altura de techo (m, opcional)").count()) === 1, "El marco permite capturar la altura de techo real al construirlo");

await page.getByPlaceholder("Ej: 10").fill("10");
await page.getByPlaceholder("Ej: 8").fill("8");
await page.getByPlaceholder("Ej: 2.4").first().fill("2.5");
await page.getByPlaceholder("Ej: Casa Familia Pérez").fill("Casa Prueba");
await page.getByRole("button", { name: "+ Crear marco", exact: true }).click();
await page.waitForTimeout(300);

assert((await page.getByText(/altura de techo: 2\.5m/).count()) >= 1, "El aviso confirma la altura de techo ingresada junto con el marco");

const inputAlturaGlobal = page.locator('input[placeholder="Ej: 2.4"]');
assert((await inputAlturaGlobal.count()) >= 1, "Queda visible un campo de altura de techo general, editable en cualquier momento");
assert((await inputAlturaGlobal.first().inputValue()) === "2.5", "El campo global refleja la altura ya establecida al crear el marco");

await page.getByRole("button", { name: "Generar ambiente", exact: true }).click();
await page.waitForTimeout(150);
assert((await page.getByPlaceholder("Largo (m)").count()) === 1, "'Generar ambiente' también dice 'Largo (m)', no 'Alto (m)'");
await page.getByPlaceholder("Nombre (ej. Habitación #1)").fill("Sala");
await page.getByPlaceholder("Ancho (m)").fill("4");
await page.getByPlaceholder("Largo (m)").fill("3");
const p = await puntoPantallaDesdeImagen({ x: 100, y: 100 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);

assert((await page.getByText("Ambientes (1)").count()) >= 1, "El ambiente 'Sala' quedó creado por su medida en planta (ancho×largo)");
assert((await page.getByText("Altura propia (m):").count()) >= 1, "Cada ambiente puede, opcionalmente, tener su propia altura de techo");

const inputAlturaAmbiente = page.locator('input[placeholder="gral. 2.5"]');
assert((await inputAlturaAmbiente.count()) === 1, "Sin override propio, el ambiente muestra la altura general heredada como referencia (gral. 2.5)");

await inputAlturaAmbiente.fill("3.2");
await page.waitForTimeout(150);
assert((await inputAlturaAmbiente.inputValue()) === "3.2", "El ambiente puede fijar su propia altura, distinta de la general (ej. doble altura en la sala)");

await inputAlturaGlobal.first().fill("2.8");
await page.waitForTimeout(150);
const inputAlturaAmbienteTrasCambio = page.locator('input[placeholder="gral. 2.8"]');
assert((await inputAlturaAmbienteTrasCambio.count()) === 1, "El placeholder del override sigue a la altura general cuando cambia (gral. 2.8)");
assert((await inputAlturaAmbienteTrasCambio.inputValue()) === "3.2", "Cambiar la altura general NO pisa el override ya fijado en un ambiente puntual");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/altura_techo_plano.png", fullPage: true });
await browser.close();
