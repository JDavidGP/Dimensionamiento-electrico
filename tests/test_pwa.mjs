// Empaquetado como PWA instalable — usuario, 2026-11-22: "quiero que
// el empaquetado sea para móviles". Prueba las condiciones mínimas de
// instalabilidad que un navegador revisa antes de ofrecer "Agregar a
// pantalla de inicio": manifest.webmanifest válido y enlazado, los
// íconos declarados existen de verdad, y el service worker se
// registra y queda listo (ver vite.config.js, plugin vite-plugin-pwa).
import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
const BASE_URL = process.env.BASE_URL || "http://localhost:4343";
await page.goto(BASE_URL, { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

// --- 1. <link rel="manifest"> presente y el archivo responde 200 con JSON válido ---
const hrefManifest = await page.locator('link[rel="manifest"]').getAttribute("href");
assert(!!hrefManifest, "El HTML enlaza un manifest.webmanifest");

const respManifest = await page.request.get(new URL(hrefManifest, BASE_URL).toString());
assert(respManifest.ok(), `El manifest responde 200 (real: ${respManifest.status()})`);
const manifest = await respManifest.json();
assert(manifest.name === "Dimensionamiento Eléctrico Completo (DEC)", "El manifest tiene el nombre correcto");
assert(manifest.display === "standalone", "display: standalone (se abre como app, sin barra del navegador)");
assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, "El manifest declara al menos 2 íconos");

// --- 2. Cada ícono declarado existe de verdad (no un 404 silencioso) ---
for (const icono of manifest.icons) {
  const resp = await page.request.get(new URL(icono.src, BASE_URL).toString());
  assert(resp.ok(), `Ícono "${icono.src}" (${icono.sizes}) responde 200 (real: ${resp.status()})`);
}

// --- 3. theme-color presente (barra de estado del celular con el color de la app) ---
const themeColor = await page.locator('meta[name="theme-color"]').getAttribute("content");
assert(themeColor === "#171512", `meta theme-color coincide con el fondo de la app (real: ${themeColor})`);

// --- 4. Service worker se registra y queda "ready" ---
const swListo = await page.evaluate(async () => {
  if (!("serviceWorker" in navigator)) return "sin-soporte";
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  return reg ? "listo" : "fallo";
});
assert(swListo === "listo", `El service worker queda registrado y listo (real: "${swListo}")`);

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página durante todo el flujo");

await browser.close();
