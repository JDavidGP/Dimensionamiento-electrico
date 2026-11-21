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

// --- 1. Vacío: la pestaña existe, no crashea, muestra mensajes de "sin datos" ---
await page.getByRole("button", { name: "Informe técnico", exact: true }).click();
await page.waitForTimeout(300);
assert(await page.getByText(/Memoria técnica/).isVisible(), "El informe se renderiza con el proyecto vacío, sin crashear");
assert(await page.getByText("Sin circuitos cargados todavía.").isVisible(), "Mensaje claro cuando no hay circuitos todavía");
assert(await page.getByText("Sin tableros cargados todavía.").isVisible(), "Mensaje claro cuando no hay tableros todavía");
assert(await page.locator("#informe-memoria-tecnica").getByText(/orientativos/).isVisible(), "El aviso de responsabilidad aparece en el informe");
assert(await page.getByRole("button", { name: /Imprimir/ }).isVisible(), "El botón de imprimir/guardar PDF está visible");

// --- 2. Cargar un circuito real con un equipo, un tablero, y confirmar que aparecen en el informe ---
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("TD-Informe");
await page.getByPlaceholder("Desde la fuente de energía").fill("10");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(200);

await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Ej: Iluminación cocina").fill("Circuito Informe");
await page.locator("label", { hasText: "Distancia (m)" }).locator("xpath=following-sibling::input[1]").fill("10");
await page.getByRole("button", { name: "+ Crear circuito" }).click();
await page.waitForTimeout(200);

await page.getByPlaceholder("Ej: Refrigerador").fill("Lámpara test");
await page.locator("label", { hasText: "P unitaria (W)" }).locator("xpath=following-sibling::input[1]").fill("150");
await page.getByRole("button", { name: "+ Agregar equipo" }).click();
await page.waitForTimeout(300);

// --- 3. Informe refleja el circuito calculado ---
await page.getByRole("button", { name: "Informe técnico", exact: true }).click();
await page.waitForTimeout(300);
const informe = page.locator("#informe-memoria-tecnica");
assert(await informe.getByText("Circuito Informe", { exact: true }).isVisible(), "El circuito cargado aparece en la tabla del informe");
assert(await informe.getByText("TD-Informe", { exact: true }).isVisible(), "El tablero cargado aparece en la tabla del informe");
assert(await informe.getByText("1 de 1 calculados").isVisible(), "El total de circuitos refleja 1 de 1 calculado OK");
assert((await informe.getByText("150 W").count()) >= 2, "La demanda total Y la fila del circuito reflejan la potencia real del equipo (150W)");

// --- 4. CSS de impresión: al emular 'print', solo el informe queda visible ---
await page.emulateMedia({ media: "print" });
await page.waitForTimeout(100);
const tabVisibleEnImpresion = await page.getByRole("button", { name: "Tableros", exact: true }).isVisible().catch(() => false);
const informeVisibleEnImpresion = await page.locator("#informe-memoria-tecnica").isVisible();
assert(!tabVisibleEnImpresion, "Al imprimir, la barra de pestañas queda oculta (visibility:hidden)");
assert(informeVisibleEnImpresion, "Al imprimir, el informe SÍ queda visible");
await page.emulateMedia({ media: "screen" });

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/informe_tecnico.png", fullPage: true });
await browser.close();
