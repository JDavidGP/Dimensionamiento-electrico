import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4330"), { waitUntil: "networkidle" });

await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("T1");
await page.getByRole("button", { name: "+ Crear tablero" }).click();
await page.waitForTimeout(200);

const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: ".json", exact: true }).click(),
]);
const ruta = await download.path();
const fs = await import("fs");
const json = JSON.parse(fs.readFileSync(ruta, "utf-8"));
console.log("nodosDiagrama en el JSON guardado:", JSON.stringify(json.nodosDiagrama));
console.log("conexionesDiagrama en el JSON guardado:", JSON.stringify(json.conexionesDiagrama));

console.log("\nErrores de página:", errores);
await browser.close();
