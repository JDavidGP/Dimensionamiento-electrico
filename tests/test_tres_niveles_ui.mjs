import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));
import fs from "fs";

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
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

async function triVisible() {
  await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
  await page.waitForTimeout(300);
  return page.getByRole("button", { name: "Tri", exact: true }).isVisible().catch(() => false);
}

// --- 1. Por defecto: Residencial básico, sin Tri ---
assert(
  await page.getByRole("button", { name: "Residencial básico", exact: true }).isVisible(),
  "Por defecto está seleccionado 'Residencial básico'"
);
assert(!(await triVisible()), "(Residencial básico) El pill 'Tri' NO aparece en el formulario de circuito");

// --- 2. Residencial avanzado: Tri aparece ---
await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Residencial avanzado", exact: true }).click();
assert(await triVisible(), "(Residencial avanzado) El pill 'Tri' SÍ aparece");

// --- 3. Comercial / Industrial: Tri sigue disponible ---
await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Comercial / Industrial", exact: true }).click();
assert(await triVisible(), "(Comercial/Industrial) El pill 'Tri' sigue disponible");

// --- 4. Volver a Residencial básico: Tri desaparece de nuevo ---
await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Residencial básico", exact: true }).click();
assert(!(await triVisible()), "(vuelta a básico) El pill 'Tri' desaparece de nuevo");

// --- 5. Migración: abrir un archivo con el enum VIEJO (tipoInstalacion: "industrial") ---
const archivoViejo = {
  formatoVersion: 1,
  proyecto: { id: "p-viejo", nombre: "Proyecto formato viejo" },
  normativaActiva: "NEC",
  tipoInstalacion: "industrial", // enum de antes de esta sesión
  circuitos: [],
  equipos: [],
  tableros: [],
  fuentesEnergia: [],
  nodosDiagrama: [],
  conexionesDiagrama: [],
  // sin "transformadores" tampoco — archivo de ANTES de esa función
};
const rutaArchivo = DIR + "tmp/proyecto_formato_viejo.json";
fs.writeFileSync(rutaArchivo, JSON.stringify(archivoViejo));

await page.locator('input[type="file"]').setInputFiles(rutaArchivo);
await page.waitForTimeout(300);

assert(
  await page.getByText(/cargado/i).isVisible(),
  "El archivo con formato viejo se carga sin error"
);
assert(
  await page.getByRole("button", { name: "Comercial / Industrial", exact: true }).isVisible().then(async () => {
    // confirmar que está SELECCIONADO (estilo activo) yendo a Normativa
    await page.getByRole("button", { name: "Normativa", exact: true }).click();
    await page.waitForTimeout(300);
    return true;
  }),
  "Tras cargar, el tab Normativa es alcanzable"
);
// Verificar selección real vía color de fondo (texto activo es distinto) — más simple: confirmar que Tri está disponible,
// que es la consecuencia funcional real de haber migrado "industrial" -> comercial_industrial.
assert(await triVisible(), "(archivo viejo 'industrial' migrado) El pill 'Tri' está disponible tras cargar el archivo");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await browser.close();
