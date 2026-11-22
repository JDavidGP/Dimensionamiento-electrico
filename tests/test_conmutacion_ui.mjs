import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4328"), { waitUntil: "networkidle" });

// 1. Crear tablero y dos fuentes (batería + generador) para tener algo que conmutar.
// Ya no hay mini-formulario inline en el form de tablero (usuario,
// 2026-11-22: lo eliminó por duplicado/confuso) — se crean en el panel
// "Declarar fuente de energía", identificado acá por su input de Nombre
// (único con ese placeholder: el form de "Configurar características"
// de una fuente ya creada usa el mismo input pero SIN placeholder).
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("Casa");

const formCrearFuente = page.locator("form").filter({ has: page.getByPlaceholder("Ej: Red eléctrica local, Generador diesel 10kW") });

await formCrearFuente.getByPlaceholder("Ej: Red eléctrica local, Generador diesel 10kW").fill("Banco solar");
await formCrearFuente.getByRole("button", { name: "Batería", exact: true }).click();
await formCrearFuente.getByRole("button", { name: "Secundaria", exact: true }).click();
await formCrearFuente.getByRole("button", { name: "+ Crear fuente" }).click();
await page.waitForTimeout(200);

await formCrearFuente.getByPlaceholder("Ej: Red eléctrica local, Generador diesel 10kW").fill("Generador diesel");
await formCrearFuente.getByRole("button", { name: "Generador", exact: true }).click();
await formCrearFuente.getByRole("button", { name: "Auxiliar", exact: true }).click();
await formCrearFuente.getByRole("button", { name: "+ Crear fuente" }).click();
await page.waitForTimeout(200);

await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(300);

// 2. Configurar conmutación
await page.getByText("+ Configurar conmutación entre fuentes").click();
await page.locator("form, div").getByRole("button", { name: "Por horario", exact: true }).click();

// Seleccionar fuente secundaria = Banco solar, auxiliar = Generador diesel
const selects = page.locator("select");
const count = await selects.count();
console.log("Cantidad de <select> visibles en la página:", count);

// Los selects de conmutación son los últimos 3 (principal/secundaria/auxiliar), en ese orden dentro del bloque.
const selectPrincipal = page.locator("select").filter({ has: page.locator('option:has-text("Red eléctrica local")') }).nth(0);
const selectSecundaria = page.locator("select").filter({ has: page.locator('option:has-text("— Ninguna —")') }).nth(0);
const selectAuxiliar = page.locator("select").filter({ has: page.locator('option:has-text("— Ninguna —")') }).nth(1);

await selectSecundaria.selectOption({ label: "Banco solar" });
await selectAuxiliar.selectOption({ label: "Generador diesel" });

await page.locator('input[type="time"]').nth(0).fill("06:00");
await page.locator('input[type="time"]').nth(1).fill("18:00");
await page.getByPlaceholder("Notas (opcional)").fill("Red de día, batería de noche, generador si falla todo");

await page.getByRole("button", { name: "Guardar", exact: true }).click();
await page.waitForTimeout(300);

const resumen = await page.getByText(/Por horario/).textContent();
console.log("Resumen de conmutación tras guardar:", resumen);

// 3. Reabrir para editar y verificar que los valores se precargan
await page.getByRole("button", { name: "✎ Editar" }).click();
const valorSecundariaTrasReabrir = await selectSecundaria.inputValue();
const nombreSecundariaTrasReabrir = await selectSecundaria.locator(`option[value="${valorSecundariaTrasReabrir}"]`).textContent();
console.log("Fuente secundaria precargada al reeditar:", nombreSecundariaTrasReabrir);
const horaInicioTrasReabrir = await page.locator('input[type="time"]').nth(0).inputValue();
console.log("Hora de inicio precargada al reeditar:", horaInicioTrasReabrir);

// 4. Desactivar
await page.getByRole("button", { name: "Desactivar", exact: true }).click();
await page.waitForTimeout(300);
const botonConfigurar = await page.getByText("+ Configurar conmutación entre fuentes").isVisible();
console.log("Tras desactivar, vuelve a mostrar '+ Configurar conmutación entre fuentes':", botonConfigurar);

console.log("\nErrores de página:", errores);
await page.screenshot({ path: DIR + "tmp/conmutacion_screenshot.png", fullPage: true });
await browser.close();
