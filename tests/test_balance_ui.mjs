import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
page.on("console", (msg) => { if (msg.type() === "error") errores.push(msg.text()); });

await page.goto((process.env.BASE_URL || "http://localhost:4327"), { waitUntil: "networkidle" });

// "Tri" no aparece por defecto — Residencial básico (nivel por
// defecto tras el rediseño de tipo de instalación en 3 niveles) lo
// oculta; hace falta subir a un nivel que sí lo ofrezca.
await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Comercial / Industrial", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(150);

// 1. Crear tablero trifásico "Panel A"
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("Panel A");
await page.locator("form").getByRole("button", { name: "Tri", exact: true }).click();
await page.getByPlaceholder("Desde la fuente de energía").fill("10");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
console.log("Tablero 'Panel A' (tri) creado: OK");

// 2. Crear 3 circuitos mono con equipo, asignarlos al tablero y a L1/L2/L3
async function crearCircuitoConEquipo(nombre, potenciaW) {
  await page.getByPlaceholder("Ej: Iluminación cocina").fill(nombre);
  await page.getByPlaceholder("Ej: Iluminación cocina").locator("..").locator("..").getByRole("button", { name: "120V" }).first().click().catch(() => {});
  await page.getByRole("button", { name: "+ Crear circuito" }).click();
  await page.getByPlaceholder("Ej: Refrigerador").fill("carga");
  await page.locator('input[type="number"]').nth(1).fill(String(potenciaW)); // P unitaria (W) - el segundo number input del form de equipo
  await page.getByRole("button", { name: "+ Agregar equipo" }).click();
}

// Como hay varios inputs numéricos en la página, ubicamos el de "P unitaria (W)" por su label asociado vía el campo de equipo.
async function crearCircuito(nombre) {
  await page.getByPlaceholder("Ej: Iluminación cocina").fill(nombre);
  await page.locator("label:has-text('Distancia (m)')").locator("..").locator("input").fill("5");
  await page.getByRole("button", { name: "+ Crear circuito" }).click();
}

async function agregarEquipo(potenciaW) {
  const nombreEquipo = page.getByPlaceholder("Ej: Refrigerador");
  await nombreEquipo.fill("carga");
  // El campo "P unitaria (W)" es un input numérico sin placeholder — lo tomamos por posición dentro del formulario de equipo (grid Cant./Valor/cosφ).
  const campoValor = page.locator("label:has-text('P unitaria (W)')").locator("..").locator("input");
  await campoValor.fill(String(potenciaW));
  await page.getByRole("button", { name: "+ Agregar equipo" }).click();
}

await crearCircuito("Luces");
await agregarEquipo(1200); // ~10A @120V
console.log("Circuito 'Luces' + equipo creado: OK");

await crearCircuito("Tomas");
await agregarEquipo(1200); // ~10A
console.log("Circuito 'Tomas' + equipo creado: OK");

await crearCircuito("Aire");
await agregarEquipo(3600); // ~30A
console.log("Circuito 'Aire' + equipo creado: OK");

// 3. Asignar cada circuito al tablero "Panel A" vía el select de cada fila
const filas = ["Luces", "Tomas", "Aire"];
for (const nombre of filas) {
  const fila = page.locator("div").filter({ hasText: new RegExp(`^${nombre}`) }).first();
}
// Los selects de tablero están en orden de creación (Luces, Tomas, Aire aparecen en ese orden en la tabla)
const selectsTablero = page.getByRole("combobox", { name: /^Tablero de/ });
const cantidadSelects = await selectsTablero.count();
console.log("Cantidad de selects de tablero encontrados:", cantidadSelects);
for (let i = 0; i < cantidadSelects; i++) {
  await selectsTablero.nth(i).selectOption({ label: "Panel A" });
}
console.log("Los 3 circuitos asignados a 'Panel A': OK");

// 4. Expandir cada circuito (usando el <select> de tablero de esa fila,
// que es hijo directo de la fila clickeable, como ancla inequívoca —
// "Aire" como texto también aparece en el panel de breakers de abajo)
// y asignar su línea.
async function expandirYAsignarLinea(nombreCircuito, linea) {
  const select = page.locator(`[aria-label="Tablero de ${nombreCircuito}"]`);
  const fila = select.locator("xpath=..");
  await fila.click();
  await page.getByRole("button", { name: linea, exact: true }).first().click();
  await fila.click(); // colapsar de nuevo
}

await expandirYAsignarLinea("Luces", "L1");
await expandirYAsignarLinea("Tomas", "L2");
await expandirYAsignarLinea("Aire", "L3");
console.log("Líneas asignadas (Luces->L1, Tomas->L2, Aire->L3): OK");

// 5. El tablero "Panel A" queda expandido automáticamente al crearlo
// (setTableroActivoId en PanelTableros.jsx) — no hace falta clickearlo.
// Verificamos el bloque de balance directamente.
await page.waitForTimeout(300);

const textoBalance = await page.getByText("Balance de fases").first().isVisible();
console.log("Bloque 'Balance de fases' visible:", textoBalance);

const porcentaje = await page.locator("text=/\\d+\\.\\d%/").first().textContent().catch(() => null);
console.log("Porcentaje de desbalance mostrado:", porcentaje);

const sugerencia = await page.getByText("Sugerencia para mejorar el balance").isVisible().catch(() => false);
console.log("Sugerencia de balance visible (excede el umbral por defecto 10%):", sugerencia);

const mencionaAire = await page.getByText("Aire (circuito)").isVisible().catch(() => false);
console.log("La sugerencia identifica a 'Aire' como principal contribuyente de la línea más cargada:", mencionaAire);

const mencionaDiscrecion = await page.getByText(/criterio del instalador/).first().isVisible().catch(() => false);
console.log("Texto de 'a criterio del instalador' presente:", mencionaDiscrecion);

console.log("\nErrores de consola/página:", errores.filter(e => !e.includes("favicon")));

await page.screenshot({ path: DIR + "tmp/balance_screenshot.png", fullPage: true });
const htmlPanel = await page.locator("body").innerHTML();
await import("fs").then(fs => fs.writeFileSync(DIR + "tmp/body.html", htmlPanel));

await browser.close();
