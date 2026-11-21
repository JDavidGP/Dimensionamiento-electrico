import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto((process.env.BASE_URL || "http://localhost:4325"), { waitUntil: "networkidle" });

// Click Industrial, guardar
await page.getByRole("button", { name: "Industrial", exact: true }).click();
const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: /Guardar/ }).click(),
]);
const ruta = await download.path();

// Recargar la página (estado fresco) y abrir el archivo guardado
await page.reload({ waitUntil: "networkidle" });
const domiciliariaFresca = page.getByRole("button", { name: "Domiciliaria", exact: true });
const colorFresco = await domiciliariaFresca.evaluate(el => getComputedStyle(el).backgroundColor);
console.log("Tras recargar (sin abrir archivo), Domiciliaria activa por defecto:", colorFresco);

await page.locator('input[type="file"]').setInputFiles(ruta);
await page.waitForTimeout(400);

const industrialTrasAbrir = page.getByRole("button", { name: "Industrial", exact: true });
const colorIndustrialTrasAbrir = await industrialTrasAbrir.evaluate(el => getComputedStyle(el).backgroundColor);
console.log("Tras abrir el archivo guardado como Industrial, color de Industrial:", colorIndustrialTrasAbrir);

await browser.close();
