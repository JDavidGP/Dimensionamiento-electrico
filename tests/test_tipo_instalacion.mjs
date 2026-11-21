import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4325"), { waitUntil: "networkidle" });

// 1. Default: "Domiciliaria" activa
const domiciliaria = page.getByRole("button", { name: "Domiciliaria", exact: true });
const industrial = page.getByRole("button", { name: "Industrial", exact: true });
await domiciliaria.waitFor({ state: "visible" });

const colorDomiciliariaInicial = await domiciliaria.evaluate(el => getComputedStyle(el).backgroundColor);
const colorIndustrialInicial = await industrial.evaluate(el => getComputedStyle(el).backgroundColor);
console.log("Color Domiciliaria (debería ser el 'activo', copper):", colorDomiciliariaInicial);
console.log("Color Industrial (debería ser transparente):", colorIndustrialInicial);

// Nota informativa visible
const notaVisible = await page.getByText("todavía no agrega ni quita equipos").isVisible();
console.log("Nota 'por ahora es informativo' visible:", notaVisible);

// 2. Click Industrial -> pasa a activo
await industrial.click();
const colorIndustrialTrasClick = await industrial.evaluate(el => getComputedStyle(el).backgroundColor);
const colorDomiciliariaTrasClick = await domiciliaria.evaluate(el => getComputedStyle(el).backgroundColor);
console.log("Tras click en Industrial -> color Industrial:", colorIndustrialTrasClick, "| color Domiciliaria:", colorDomiciliariaTrasClick);

// 3. Guardar proyecto y verificar que el JSON descargado incluye tipoInstalacion:"industrial"
const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: /Guardar/ }).click(),
]);
const rutaDescarga = await download.path();
const fs = await import("fs");
const contenido = JSON.parse(fs.readFileSync(rutaDescarga, "utf-8"));
console.log("JSON guardado incluye tipoInstalacion:", contenido.tipoInstalacion);

console.log("\nErrores de página:", errores);
await browser.close();
