import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4352"), { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

// --- 0. Crear un tablero y 2 circuitos (sin asignarlos, para probar con etiquetas simples C1/C2) ---
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: "+ Nuevo tablero", exact: true }).click();
await page.waitForTimeout(150);
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("Tablero principal");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(200);

await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(200);

await page.getByPlaceholder("Ej: Iluminación cocina").fill("Iluminación cocina");
await page.locator("label", { hasText: "Distancia (m)" }).locator("xpath=following-sibling::input[1]").fill("10");
await page.getByRole("button", { name: "+ Crear circuito" }).click();
await page.waitForTimeout(200);

await page.getByPlaceholder("Ej: Iluminación cocina").fill("Tomas cocina");
await page.locator("label", { hasText: "Distancia (m)" }).locator("xpath=following-sibling::input[1]").fill("12");
await page.getByRole("button", { name: "+ Crear circuito" }).click();
await page.waitForTimeout(200);

// --- 1. Abrir el panel de importación y previsualizar un texto con 1 línea inválida mezclada ---
await page.getByRole("button", { name: /Importar equipos por texto/ }).click();
await page.waitForTimeout(150);

const textoImportar = `C1
5 Bombillo 40W
35 Bombillo 20W
3 Bombillo roto 0W

C2
1 Refrigerador 1200W`;
await page.locator("textarea").fill(textoImportar);
await page.getByRole("button", { name: "Previsualizar", exact: true }).click();
await page.waitForTimeout(200);

assert((await page.getByText(/✓ 5× Bombillo — 40W → C1/).count()) === 1, "Previsualización: la línea 'Bombillo 40W' se interpreta y vincula a C1 correctamente");
assert((await page.getByText(/✓ 35× Bombillo — 20W → C1/).count()) === 1, "Previsualización: la línea 'Bombillo 20W' también vincula a C1");
assert((await page.getByText(/✓ 1× Refrigerador — 1200W → C2/).count()) === 1, "Previsualización: el Refrigerador vincula a C2 (bloque distinto)");
assert((await page.getByText(/✗.*mayor a 0/).count()) === 1, "Previsualización: la línea con 0W se marca como inválida, con el motivo de la validación real");
assert((await page.getByText(/1 línea con error/).count()) === 1, "Se informa cuántas líneas quedaron con error");

// --- 2. Importar — deben crearse los 3 equipos VÁLIDOS, la línea inválida se descarta sola ---
await page.getByRole("button", { name: "Importar 3 equipos", exact: true }).click();
await page.waitForTimeout(300);

assert((await page.getByText("3 equipos importados.").count()) === 1, "Aviso de confirmación: 3 equipos importados");
assert((await page.locator("textarea").inputValue()) === "", "El textarea se limpia después de importar");

// --- 3. Verificar en Directorio que los equipos quedaron en el circuito correcto ---
await page.getByRole("button", { name: "Directorio", exact: true }).click();
await page.waitForTimeout(300);
const panelDirectorio = page.getByText("Directorio — tableros, diagrama y plano desde un solo lugar", { exact: true }).locator("xpath=..");

assert((await panelDirectorio.getByText(/Tableros, circuitos y equipos \(6\)/).count()) === 1, "Directorio cuenta 1 tablero + 2 circuitos + 3 equipos = 6 (la línea inválida NO se coló)");
assert((await panelDirectorio.locator('input[value="Bombillo"]').count()) === 2, "Los 2 equipos 'Bombillo' (40W y 20W) aparecen en el árbol");
assert((await panelDirectorio.locator('input[value="Refrigerador"]').count()) === 1, "El 'Refrigerador' aparece en el árbol");

// Confirmar que están anidados bajo el circuito CORRECTO: el primer
// "Iluminación cocina" (C1, abierto) debe contener a los 2 Bombillo;
// "Tomas cocina" (C2) debe contener al Refrigerador.
const filaC1 = panelDirectorio.locator('input[value="Iluminación cocina"]').locator("xpath=../../..");
assert((await filaC1.locator('input[value="Bombillo"]').count()) === 2, "Los 2 Bombillo quedan ANIDADOS bajo el circuito C1 (Iluminación cocina), no sueltos");
const filaC2 = panelDirectorio.locator('input[value="Tomas cocina"]').locator("xpath=../../..");
assert((await filaC2.locator('input[value="Refrigerador"]').count()) === 1, "El Refrigerador queda anidado bajo el circuito C2 (Tomas cocina)");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/importacion_equipos.png", fullPage: true });
await browser.close();
