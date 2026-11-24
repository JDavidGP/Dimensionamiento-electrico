// Tipo de instalación persiste al guardar/reabrir — reescrito
// 2026-11-24 con el enum de 3 niveles (ver test_tipo_instalacion.mjs
// para el porqué completo del cambio de nombres/valores).
import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4325"), { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(150);

// Click "Comercial / Industrial", guardar como .json
await page.getByRole("button", { name: "Comercial / Industrial", exact: true }).click();
await page.waitForTimeout(100);
const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: ".json", exact: true }).click(),
]);
const ruta = await download.path();

// Recargar la página (estado fresco): vuelve a "Residencial básico" por defecto
await page.reload({ waitUntil: "networkidle" });
await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(150);
const residencialBasicoFresco = page.getByRole("button", { name: "Residencial básico", exact: true });
const comercialIndustrialFresco = page.getByRole("button", { name: "Comercial / Industrial", exact: true });
const colorBasicoFresco = await residencialBasicoFresco.evaluate(el => getComputedStyle(el).backgroundColor);
const colorIndustrialFresco = await comercialIndustrialFresco.evaluate(el => getComputedStyle(el).backgroundColor);
assert(colorBasicoFresco !== colorIndustrialFresco, "Tras recargar (sin abrir archivo), 'Residencial básico' vuelve a ser el activo por defecto");

// Abrir el archivo guardado como "Comercial / Industrial"
await page.getByLabel("↑ Abrir").setInputFiles(ruta);
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(150);

const industrialTrasAbrir = page.getByRole("button", { name: "Comercial / Industrial", exact: true });
const colorIndustrialTrasAbrir = await industrialTrasAbrir.evaluate(el => getComputedStyle(el).backgroundColor);
// El color "activo" es el mismo que tenía 'Residencial básico' recién
// recargado (es un estilo, no depende de CUÁL botón lo tenga) — tras
// abrir el archivo guardado como Comercial/Industrial, ESE botón debe
// ahora lucir con ese mismo color "activo".
assert(colorIndustrialTrasAbrir === colorBasicoFresco, `Tras abrir el archivo guardado como Comercial/Industrial, ese botón queda activo (real: ${colorIndustrialTrasAbrir}, esperado: ${colorBasicoFresco})`);

console.log("\nErrores de página:", errores);
await browser.close();
