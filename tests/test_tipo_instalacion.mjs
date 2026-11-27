// Tipo de instalación — reescrito 2026-11-24: el enum de 2 niveles
// ("Domiciliaria"/"Industrial") se reemplazó por 3 niveles
// ("Residencial básico"/"Residencial avanzado"/"Comercial / Industrial",
// ver TIPOS_INSTALACION en shared/constants/constantes.ts). El valor
// guardado en el JSON también cambió: ya no es "industrial" sino
// "comercial_industrial".
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
await page.waitForTimeout(200);

// 1. Default: "Residencial básico" activo
const residencialBasico = page.getByRole("button", { name: "Residencial básico", exact: true });
const comercialIndustrial = page.getByRole("button", { name: "Comercial / Industrial", exact: true });
await residencialBasico.waitFor({ state: "visible" });

const colorBasicoInicial = await residencialBasico.evaluate(el => getComputedStyle(el).backgroundColor);
const colorIndustrialInicial = await comercialIndustrial.evaluate(el => getComputedStyle(el).backgroundColor);
assert(colorBasicoInicial !== colorIndustrialInicial, "'Residencial básico' (activo) y 'Comercial / Industrial' (inactivo) tienen colores distintos por defecto");

// 2. Click "Comercial / Industrial" -> pasa a activo
await comercialIndustrial.click();
await page.waitForTimeout(100);
const colorIndustrialTrasClick = await comercialIndustrial.evaluate(el => getComputedStyle(el).backgroundColor);
const colorBasicoTrasClick = await residencialBasico.evaluate(el => getComputedStyle(el).backgroundColor);
assert(colorIndustrialTrasClick === colorBasicoInicial, "Tras click, 'Comercial / Industrial' toma el color de 'activo'");
assert(colorBasicoTrasClick === colorIndustrialInicial, "Tras click, 'Residencial básico' pasa a 'inactivo'");

// 3. Guardar proyecto (.json) y verificar que incluye tipoInstalacion correcto
const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: ".json", exact: true }).click(),
]);
const rutaDescarga = await download.path();
const fs = await import("fs");
const contenido = JSON.parse(fs.readFileSync(rutaDescarga, "utf-8"));
assert(contenido.tipoInstalacion === "comercial_industrial", `El JSON guardado incluye tipoInstalacion correcto (real: ${contenido.tipoInstalacion})`);

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página");
await browser.close();
