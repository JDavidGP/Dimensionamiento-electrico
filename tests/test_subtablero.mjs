import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto((process.env.BASE_URL || "http://localhost:4340"), { waitUntil: "networkidle" });

// "Tri" no aparece en Residencial básico (nivel por defecto) — subir
// a un nivel que sí lo ofrezca.
await page.getByRole("button", { name: "Normativa", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Comercial / Industrial", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(150);

await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("Principal");
await page.locator("form").getByRole("button", { name: "Tri", exact: true }).click();
await page.getByPlaceholder("Desde la fuente de energía").fill("10");
await page.getByRole("button", { name: "+ Crear tablero" }).click();

await page.getByRole("button", { name: "+ Subtablero" }).click();
await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("Sub Cocina");
await page.locator("form").getByRole("button", { name: "Bi", exact: true }).click();
await page.getByPlaceholder("Desde la fuente de energía").fill("8");
await page.getByRole("button", { name: /Crear tablero/ }).click();

await page.waitForTimeout(300);
const texto = await page.getByText(/Línea\(s\) del alimentador en/).textContent().catch(() => null);
console.log("Texto selector lineasAlimentador:", texto);

// clic en L1 y L2 para asignar
await page.getByRole("button", { name: "L1", exact: true }).first().click();
await page.getByRole("button", { name: "L2", exact: true }).first().click();
await page.waitForTimeout(200);

await page.screenshot({ path: DIR + "tmp/subtablero.png", fullPage: true });
await browser.close();
