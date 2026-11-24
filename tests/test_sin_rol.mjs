// Rol opcional en fuentes de energía — reescrito 2026-11-24 tras el
// rediseño de rol global (usuario, 2026-11-20): el panel ya no se
// llama "Editar fuentes de energía" (ahora son DOS paneles,
// "Declarar fuente de energía" arriba + "Configurar características"
// abajo), el botón es "+ Crear fuente" (no "+ Nueva fuente"), y el
// mini-formulario inline del tablero se eliminó por completo (usuario,
// 2026-11-22, "duplicado/confuso" con este panel dedicado). La tesis
// original del test sigue siendo válida: el rol NUNCA es obligatorio
// para crear una fuente — solo que ahora se ofrece como pill marcado
// explícitamente "(opcional)", en vez de no aparecer en absoluto.
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

await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);

// --- Los 2 paneles de fuentes de energía existen con sus nombres actuales ---
assert((await page.getByText("Declarar fuente de energía", { exact: true }).count()) === 1, "Existe el panel 'Declarar fuente de energía'");
assert((await page.getByText("Configurar características", { exact: true }).count()) === 1, "Existe el panel 'Configurar características'");

// --- Crear una fuente SIN tocar el pill de Rol: el label dice "(opcional)" y no bloquea la creación ---
const formCrearFuente = page.locator("form").filter({ has: page.getByPlaceholder("Ej: Red eléctrica local, Generador diesel 10kW") });
assert((await page.getByText("Rol en la instalación (opcional)", { exact: true }).count()) === 1, "El pill de rol está marcado explícitamente como opcional");

await formCrearFuente.getByPlaceholder("Ej: Red eléctrica local, Generador diesel 10kW").fill("Generador diesel 10kW");
await formCrearFuente.getByRole("button", { name: "Generador", exact: true }).click();
// A propósito NO se clickea ningún pill de Rol — el punto del test.
await formCrearFuente.getByRole("button", { name: "+ Crear fuente" }).click();
await page.waitForTimeout(200);

// --- La tarjeta se creó sin rol: tipo + nombre, sin "· <rol>" agregado ---
assert((await page.getByText("Generador diesel 10kW", { exact: true }).count()) >= 1, "La fuente se creó sin pedir rol");
assert((await page.getByText("Generador", { exact: true }).first().isVisible()), "La tarjeta muestra el tipo (Generador)");

// --- No existe ningún mini-formulario inline en el tablero (se eliminó, vive solo en el panel de arriba) ---
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.waitForTimeout(200);
assert((await page.getByText(/Nueva fuente de energía.*Batería.*Generador/).count()) === 0, "El mini-formulario inline del tablero ya no existe (se eliminó por duplicado/confuso)");

// --- El selector "Principal" muestra la fuente como "Nombre (Tipo)", sin rol ---
const selectPrincipal = page.locator("label").filter({ hasText: /^Fuente de energía — Principal/ }).locator("xpath=following-sibling::select[1]");
const opcionGenerador = await selectPrincipal.locator('option:has-text("Generador diesel 10kW")').textContent();
assert(opcionGenerador.trim() === "Generador diesel 10kW (Generador)", `La opción del selector dice '(Generador)' sin rol (texto real: '${opcionGenerador.trim()}')`);

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/sin_rol.png", fullPage: true });
await browser.close();
