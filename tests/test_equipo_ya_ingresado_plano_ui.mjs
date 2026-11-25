// "¿Equipo ya ingresado?" en Plano — usuario, 2026-11-25: "En circuito
// y resultados ya están los equipos ingresado correcto, por qué no
// llevamos esos id directamente al plano en la sección de colocar
// equipos y lo ubicamos de forma más sencilla". Antes había que: (1)
// elegir el tipo de símbolo a mano, (2) buscar la entidad correcta en
// un segundo <select> "Vincular a" que ni filtraba por tipo
// (candidatosEntidadEquipo devolvía TODOS los equipos sin importar el
// símbolo elegido — ver PlanoMediator.js). Ahora: un primer <select>
// lista los equipos YA cargados en Circuitos y resultados que
// todavía no tienen marcador en el plano; al elegir uno, el tipo de
// símbolo correcto se infiere solo (App.diagrama.elegirSimboloEquipo,
// la misma heurística que ya se usaba para el diagrama unifilar
// automático) y el nombre se copia — un solo click para ubicarlo.
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

// --- 0. Crear un circuito con dos equipos reales: una luminaria y un
//     tomacorriente, por nombre, para que elegirSimboloEquipo infiera
//     el tipo de símbolo correcto de cada uno. ---
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Ej: Iluminación cocina").fill("Circuito prueba plano");
await page.locator("label", { hasText: "Distancia (m)" }).locator("xpath=following-sibling::input[1]").fill("10");
await page.getByRole("button", { name: "+ Crear circuito" }).click();
await page.waitForTimeout(200);

await page.getByPlaceholder("Ej: Refrigerador").fill("Lámpara sala");
await page.locator("label", { hasText: "P unitaria (W)" }).locator("xpath=following-sibling::input[1]").fill("15");
await page.getByRole("button", { name: "+ Agregar equipo" }).click();
await page.waitForTimeout(200);

await page.getByPlaceholder("Ej: Refrigerador").fill("Tomacorriente cocina");
await page.locator("label", { hasText: "P unitaria (W)" }).locator("xpath=following-sibling::input[1]").fill("180");
await page.getByRole("button", { name: "+ Agregar equipo" }).click();
await page.waitForTimeout(200);

// --- 1. Ir a Plano, cargar imagen, calibrar (400px = 5m) ---
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

// --- 2. Colocar equipo: elegir "Lámpara sala" desde "¿Equipo ya ingresado?" ---
await page.getByRole("button", { name: "Colocar equipo", exact: true }).click();
await page.waitForTimeout(150);
const barraEquipo = page.locator('input[placeholder="Nombre (opcional)"]').locator("xpath=..");
const selectYaIngresado = barraEquipo.locator("select").first();

assert((await selectYaIngresado.locator("option").allTextContents()).some((t) => t.includes("Lámpara sala")), "'Lámpara sala' aparece como opción de equipo ya ingresado");
assert((await selectYaIngresado.locator("option").allTextContents()).some((t) => t.includes("Tomacorriente cocina")), "'Tomacorriente cocina' aparece como opción de equipo ya ingresado");

await selectYaIngresado.selectOption({ label: await selectYaIngresado.locator("option").filter({ hasText: "Lámpara sala" }).textContent() });
await page.waitForTimeout(150);

const selectTipo = barraEquipo.locator("select").nth(1);
assert((await selectTipo.locator("option:checked").textContent()) === "Luminaria", `El tipo de símbolo se infirió solo como 'Luminaria' (real: '${await selectTipo.locator("option:checked").textContent()}')`);
assert((await barraEquipo.locator('input[placeholder="Nombre (opcional)"]').inputValue()) === "Lámpara sala", "El nombre se copió del equipo elegido");

p = await puntoPantallaDesdeImagen({ x: 300, y: 250 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(300);

assert((await panelPlano.getByText("Equipos en el plano (1)").count()) === 1, "Se creó 1 marcador al colocar el equipo ya ingresado");
// TabsViewPager mantiene todas las pestañas montadas a la vez — el
// Directorio también muestra su propio "Equipos en el plano" en su
// panel, aunque no se haya entrado a esa pestaña. Acotamos a
// panelPlano y al contenedor INMEDIATO siguiente al encabezado (el
// único de los dos divs ternarios que se renderiza).
const listaEquiposPlano = panelPlano.getByText(/^Equipos en el plano \(/).locator("xpath=following-sibling::div[1]");
const selectVinculo = listaEquiposPlano.locator("select").nth(0);
assert((await selectVinculo.locator("option:checked").textContent()).includes("Lámpara sala"), "El marcador quedó vinculado automáticamente a la entidad 'Lámpara sala' (sin pasar por 'Vincular a')");

// --- 3. El selector "¿Equipo ya ingresado?" ya NO ofrece "Lámpara
//     sala" (tiene marcador) pero SÍ sigue ofreciendo "Tomacorriente
//     cocina" (todavía sin marcador) — y el formulario se reseteó. ---
assert((await selectYaIngresado.locator("option:checked").textContent()) === "¿Equipo ya ingresado?", "El selector se resetea tras colocar el marcador");
const opcionesTrasColocar = await selectYaIngresado.locator("option").allTextContents();
assert(!opcionesTrasColocar.some((t) => t.includes("Lámpara sala")), "'Lámpara sala' ya NO aparece (ya tiene marcador en el plano)");
assert(opcionesTrasColocar.some((t) => t.includes("Tomacorriente cocina")), "'Tomacorriente cocina' sigue disponible (todavía sin marcador)");

// --- 4. Elegir "Tomacorriente cocina" infiere tipo "Contacto (tomacorriente)" ---
await selectYaIngresado.selectOption({ label: await selectYaIngresado.locator("option").filter({ hasText: "Tomacorriente cocina" }).textContent() });
await page.waitForTimeout(150);
assert((await selectTipo.locator("option:checked").textContent()) === "Contacto (tomacorriente)", `El tipo se infirió como 'Contacto (tomacorriente)' (real: '${await selectTipo.locator("option:checked").textContent()}')`);

p = await puntoPantallaDesdeImagen({ x: 350, y: 300 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(300);
assert((await panelPlano.getByText("Equipos en el plano (2)").count()) === 1, "Se creó un 2do marcador ('Tomacorriente cocina')");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await browser.close();
