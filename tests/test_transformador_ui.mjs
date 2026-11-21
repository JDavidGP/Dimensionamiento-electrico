import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4343"), { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

// --- 1. Por defecto (domiciliaria): el link de transformador NO aparece ---
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(350);
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
assert(
  !(await page.getByRole("button", { name: "+ Nuevo transformador" }).isVisible().catch(() => false)),
  "(domiciliaria) El link '+ Nuevo transformador' NO aparece en el formulario de tablero"
);

// --- 2. Cambiar a comercial/industrial ---
// 3er nivel de TIPOS_INSTALACION (ver shared/constants/constantes.js):
// ya no hay un botón "Industrial" — es "Comercial / Industrial".
await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(350);
await page.getByRole("button", { name: "Comercial / Industrial", exact: true }).click();

// --- 3. En Tableros, ahora sí aparece ---
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(350);
// .first(): desde que Transformador tiene su propio panel con CRUD
// completo (PanelTransformadores.jsx), también existe un "+ Nuevo
// transformador" ahí — el de acá (el atajo inline dentro del
// formulario de tablero, que esta prueba quiere) es el primero en el DOM.
assert(
  await page.getByRole("button", { name: "+ Nuevo transformador" }).first().isVisible(),
  "(industrial) El link '+ Nuevo transformador' SÍ aparece en el formulario de tablero"
);

// --- 4. Crear el transformador inline y usarlo como origen ---
await page.getByRole("button", { name: "+ Nuevo transformador" }).first().click();
await page.getByPlaceholder("Ej: Transformador reductor 480V→240V").fill("TR-TEST");
await page.getByPlaceholder("Tensión primaria (V)").fill("480");
await page.getByPlaceholder("Tensión secundaria (V)").fill("240");
await page.getByRole("button", { name: "+ Crear y usar como origen" }).click();
await page.waitForTimeout(150);

await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("TD-TRAFO");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(200);

assert(await page.getByText("TD-TRAFO").first().isVisible(), "El tablero se creó con el transformador como origen");
assert(
  await page.getByText("TR-TEST (Transformador · 480V→240V)").first().isVisible(),
  "La tarjeta del tablero muestra 'Alimenta desde: TR-TEST (Transformador · 480V→240V)' (tarjeta auto-expandida al crear)"
);

// --- 5. Sincronización con el diagrama: el transformador aparece como candidato para un nodo "Transformador" ---
// Diagrama unifilar y Plano viven agrupados bajo "Esquemas" (ver SubTabs.jsx).
await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Diagrama unifilar", exact: true }).click();
await page.waitForTimeout(350);
const selectTipo = page.locator("select").filter({ has: page.locator('option:has-text("Acometida")') });
await selectTipo.selectOption({ label: "Transformador" });
const selectVinculo = page.locator("select").filter({ has: page.locator('option:has-text("— Vincular a (opcional) —")') });
assert(
  (await selectVinculo.locator('option:has-text("TR-TEST")').count()) === 1,
  "El transformador creado aparece como candidato para vincular a un nodo 'Transformador' del diagrama"
);
await selectVinculo.selectOption({ label: "TR-TEST" });
await page.getByRole("button", { name: "+ Agregar", exact: true }).click();
await page.waitForTimeout(200);
const textosSvg = await page.locator("svg text").allTextContents();
assert(textosSvg.includes("TR-TEST"), "El nodo del diagrama muestra el nombre vivo del transformador vinculado");

// --- 6. Si se vuelve a residencial básico, el transformador deja de verse como opción de origen (pero sigue existiendo) ---
await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(350);
await page.getByRole("button", { name: "Residencial básico", exact: true }).click();
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(350);
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
assert(
  !(await page.getByRole("button", { name: "+ Nuevo transformador" }).isVisible().catch(() => false)),
  "(vuelta a domiciliaria) El link de transformador desaparece de nuevo"
);

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await page.screenshot({ path: DIR + "tmp/transformador_ui.png", fullPage: true });
await browser.close();
