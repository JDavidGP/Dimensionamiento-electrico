import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4340"), { waitUntil: "networkidle" });

// "Tri" no aparece en Residencial básico (nivel por defecto, cubre
// ambas secciones de este test, NEC y REBT) — subir a un nivel que sí
// lo ofrezca.
await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Comercial / Industrial", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(150);

// 1. Normativa por defecto es NEC — abrir "+ Nuevo tablero" y chequear pills
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
let pillsTexto = await page.locator("form").getByRole("button", { name: /V$/ }).allTextContents();
console.log("Pills de tensión bajo NEC (mono por defecto):", pillsTexto);

// Cambiar a Tri y ver que las pills cambian a las de NEC trifásico
await page.locator("form").getByRole("button", { name: "Tri", exact: true }).click();
pillsTexto = await page.locator("form").getByRole("button", { name: /V$/ }).allTextContents();
console.log("Pills de tensión bajo NEC (tri):", pillsTexto);

// Intentar escribir un voltaje arbitrario directamente: NO debería haber un input de "Tensión del alimentador" libre visible (solo aparece si se activa "Manual")
const campoTensionManual = page.getByPlaceholder("Tensión del alimentador (V)");
const inputLibreVisible = await campoTensionManual.count();
console.log("Input de tensión libre visible (debería ser 0 sin tocar 'Manual'):", inputLibreVisible);

// Activar "Manual" y verificar que AHORA sí aparece el input libre
await page.locator("form").getByRole("button", { name: "Manual" }).click();
const inputManualVisible = await campoTensionManual.count();
console.log("Input de tensión libre tras activar 'Manual':", inputManualVisible);
await campoTensionManual.fill("999");
const valorManual = await campoTensionManual.inputValue();
console.log("Valor manual aceptado (999, fuera de estándar, con intención explícita):", valorManual);

await page.locator("form").getByRole("button", { name: "Cancelar", exact: true }).click();

// 2. Cambiar normativa activa a REBT (IEC_ES): botón de familia -> "IEC" -> "Validar"
await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: /Normativa ▾|NEC ▾|CIEN ▾/ }).first().click();
await page.getByRole("button", { name: "IEC", exact: true }).click();
await page.getByRole("button", { name: "Validar" }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(150);

await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
pillsTexto = await page.locator("form").getByRole("button", { name: /V$/ }).allTextContents();
console.log("Pills de tensión bajo REBT (mono):", pillsTexto);

await page.locator("form").getByRole("button", { name: "Tri", exact: true }).click();
pillsTexto = await page.locator("form").getByRole("button", { name: /V$/ }).allTextContents();
console.log("Pills de tensión bajo REBT (tri):", pillsTexto);

console.log("\nErrores de página:", errores);
await browser.close();
