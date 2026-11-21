import { chromium } from "playwright";

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
page.on("console", (msg) => { if (msg.type() === "error") errores.push(msg.text()); });

await page.goto((process.env.BASE_URL || "http://localhost:4322"), { waitUntil: "networkidle" });

// 1. Botón de menú visible
const boton = page.getByRole("button", { name: "Abrir menú de opciones" });
await boton.waitFor({ state: "visible", timeout: 5000 });
console.log("Botón de menú visible: OK");

// 2. Abrir menú, ver 3 opciones
await boton.click();
const ajustesItem = page.getByRole("button", { name: "Ajustes", exact: true });
const ayudaItem = page.getByRole("button", { name: "Ayuda", exact: true });
const privItem = page.getByRole("button", { name: "Privacidad y responsabilidad" });
await ajustesItem.waitFor({ state: "visible" });
await ayudaItem.waitFor({ state: "visible" });
await privItem.waitFor({ state: "visible" });
console.log("Las 3 opciones del menú visibles: OK");

// 3. Abrir Ajustes, cambiar umbral
await ajustesItem.click();
const dialogAjustes = page.getByRole("dialog", { name: "Ajustes" });
await dialogAjustes.waitFor({ state: "visible" });
const input = dialogAjustes.locator('input[type="number"]');
const valorInicial = await input.inputValue();
console.log("Valor inicial del umbral:", valorInicial);
await input.fill("15");
await input.blur();
const advertenciaEsperada = dialogAjustes.locator("text=por encima de 10%");
// no debería verse advertencia aquí (esa va en resultados, no en el panel)
console.log("Ajustes: cambio de umbral a 15 aplicado sin error: OK");

// cerrar con X
await dialogAjustes.getByRole("button", { name: "Cerrar" }).click();
await dialogAjustes.waitFor({ state: "hidden" });
console.log("Cierre de panel Ajustes: OK");

// 4. Reabrir menú, abrir Ayuda
await boton.click();
await ayudaItem.waitFor({ state: "visible" });
await ayudaItem.click();
const dialogAyuda = page.getByRole("dialog", { name: "Ayuda" });
await dialogAyuda.waitFor({ state: "visible" });
console.log("Panel Ayuda visible: OK");
// cerrar clicando fuera (overlay)
await page.mouse.click(5, 5);
await dialogAyuda.waitFor({ state: "hidden" });
console.log("Cierre de panel Ayuda por click fuera: OK");

// 5. Reabrir menú, click en Privacidad -> scroll a pie de página
await boton.click();
await privItem.waitFor({ state: "visible" });
await privItem.click();
await page.waitForTimeout(600);
const footerVisible = await page.locator("#pie-pagina").isVisible();
const footerBox = await page.locator("#pie-pagina").boundingBox();
const viewport = page.viewportSize();
console.log("Footer visible:", footerVisible, "boundingBox top:", footerBox?.y, "viewport height:", viewport?.height);

// 6. Verificar que el valor del umbral persiste tras cerrar/reabrir (estado de React)
await boton.click();
await ajustesItem.waitFor({ state: "visible" });
await ajustesItem.click();
const dialogAjustes2 = page.getByRole("dialog", { name: "Ajustes" });
await dialogAjustes2.waitFor({ state: "visible" });
const valorPersistido = await dialogAjustes2.locator('input[type="number"]').inputValue();
console.log("Valor del umbral tras reabrir:", valorPersistido, valorPersistido === "15" ? "(persistió correctamente)" : "(NO persistió)");

console.log("Errores de consola/página:", errores.length ? errores : "ninguno");

await browser.close();
