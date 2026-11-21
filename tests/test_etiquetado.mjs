import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4352"), { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

// --- 1. La pestaña Directorio existe y muestra el estado vacío ---
assert((await page.getByRole("button", { name: "Directorio", exact: true }).count()) === 1, "La pestaña 'Directorio' existe");
await page.getByRole("button", { name: "Directorio", exact: true }).click();
await page.waitForTimeout(300);
assert((await page.getByText("Todavía no hay nada en el proyecto.").count()) === 1, "Estado vacío del Directorio");

// --- 2. Crear un tablero: etiqueta autosugerida "TD1" ---
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.waitForTimeout(150);
const etiquetaTablero = page.locator("label").filter({ hasText: /^Etiqueta$/ }).first().locator("xpath=following-sibling::input[1]");
assert((await etiquetaTablero.inputValue()) === "TD1", `La etiqueta del tablero se autosugiere 'TD1' (real: '${await etiquetaTablero.inputValue()}')`);
await page.locator("label").filter({ hasText: /^Función \(opcional\)$/ }).first().locator("xpath=following-sibling::input[1]").fill("Panel principal de la vivienda");
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("Tablero principal");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(300);

// --- 3. Segundo tablero: autosugiere "TD2" (no choca con TD1) ---
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.waitForTimeout(150);
assert((await etiquetaTablero.inputValue()) === "TD2", `El segundo tablero autosugiere 'TD2' (real: '${await etiquetaTablero.inputValue()}')`);
await page.getByRole("button", { name: "Cancelar", exact: true }).first().click();
await page.waitForTimeout(150);

// --- 4. Crear un circuito: etiqueta autosugerida "C1" ---
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
const etiquetaCircuito = page.locator("label").filter({ hasText: /^Etiqueta$/ }).first().locator("xpath=following-sibling::input[1]");
assert((await etiquetaCircuito.inputValue()) === "C1", `La etiqueta del circuito se autosugiere 'C1' (real: '${await etiquetaCircuito.inputValue()}')`);
await page.getByPlaceholder("Ej: Iluminación cocina").fill("Circuito iluminación");
await page.locator("label").filter({ hasText: /^Función \(opcional\)$/ }).first().locator("xpath=following-sibling::input[1]").fill("Ilumina la sala principal");
await page.locator("label", { hasText: "Distancia (m)" }).locator("xpath=following-sibling::input[1]").fill("10");
await page.getByRole("button", { name: "+ Crear circuito" }).click();
await page.waitForTimeout(200);

// --- 5. Crear un equipo dentro del circuito: etiqueta "C1-E1" ---
const etiquetaEquipo = page.locator("label").filter({ hasText: /^Etiqueta$/ }).nth(1).locator("xpath=following-sibling::input[1]");
assert((await etiquetaEquipo.inputValue()) === "C1-E1", `La etiqueta del equipo se autosugiere 'C1-E1' (real: '${await etiquetaEquipo.inputValue()}')`);
await page.getByPlaceholder("Ej: Refrigerador").fill("Lámpara LED");
await page.locator("label").filter({ hasText: /^Función \(opcional\)$/ }).nth(1).locator("xpath=following-sibling::input[1]").fill("Ilumina el área de estar");
await page.locator("label", { hasText: "P unitaria (W)" }).locator("xpath=following-sibling::input[1]").fill("15");
await page.getByRole("button", { name: "+ Agregar equipo" }).click();
await page.waitForTimeout(300);

// --- 5b. Asignar el circuito a TD1 (si no, queda "sin tablero" y la
// prueba del árbol anidado de abajo no tendría sentido — un circuito
// no se asigna solo al crearse, es un paso aparte en TablaResultados) ---
await page.getByLabel("Tablero de Circuito iluminación").selectOption({ label: "Tablero principal" });
await page.waitForTimeout(200);

// --- 6. El Directorio (ahora un árbol plegable y editable, ronda
// siguiente al pedido del usuario de unir Diagrama/Planos bajo un
// mismo menú) muestra los 3 objetos anidados: tablero > circuito > equipo ---
await page.getByRole("button", { name: "Directorio", exact: true }).click();
await page.waitForTimeout(300);
assert((await page.locator('input[value="TD1"]').count()) === 1, "El tablero TD1 aparece editable en el árbol");
assert((await page.locator('input[value="Panel principal de la vivienda"]').count()) === 1, "La función del tablero aparece editable en el árbol");
assert((await page.locator('input[value="C1"]').count()) === 1, "El circuito C1 aparece editable, anidado bajo su tablero");
assert((await page.locator('input[value="C1-E1"]').count()) === 1, "El equipo C1-E1 aparece editable, anidado bajo su circuito");
assert((await page.getByText(/Tableros, circuitos y equipos \(3\)/).count()) === 1, "El contador de la sección dice 3 (1 tablero + 1 circuito + 1 equipo)");

// --- 7. Buscar filtra correctamente, manteniendo visibles los ancestros ---
await page.getByPlaceholder("Buscar por etiqueta, nombre o función…").fill("Lámpara");
await page.waitForTimeout(150);
assert((await page.locator('input[value="Lámpara LED"]').count()) === 1, "La búsqueda encuentra el equipo por nombre");
assert((await page.locator('input[value="TD1"]').count()) === 1, "El tablero ancestro sigue visible para dar contexto, aunque no coincida él mismo");
await page.getByPlaceholder("Buscar por etiqueta, nombre o función…").fill("");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/directorio.png", fullPage: true });
await browser.close();
