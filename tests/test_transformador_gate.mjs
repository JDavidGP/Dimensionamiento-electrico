import { chromium } from "playwright";

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto((process.env.BASE_URL || "http://localhost:4352"), { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: "Comercial / Industrial", exact: true }).click();
await page.waitForTimeout(200);

await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.waitForTimeout(200);

// Ahora hay 2 entradas válidas a propósito (el link inline del form
// de tablero + el panel dedicado "Transformadores" más abajo) — no es
// un bug, solo creció la UI. Se acota a botones reales (role=button)
// para no contar además la mención entre comillas del texto de ayuda
// del panel vacío ("Sin transformadores todavía — '+ Nuevo
// transformador' acá...").
assert((await page.getByRole("button", { name: "+ Nuevo transformador", exact: true }).count()) >= 1, "Comercial/Industrial: Transformador SÍ se ofrece como fuente de energía");

const fasesAlimentador = page.locator("label").filter({ hasText: "Fases del alimentador" }).locator("xpath=following-sibling::div[1]");
assert((await fasesAlimentador.getByRole("button", { name: "Tri", exact: true }).count()) === 1, "Comercial/Industrial: 'Tri' SÍ aparece en Fases del alimentador");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página");
await browser.close();
