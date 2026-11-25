// "Generar circuito" en Plano — usuario, 2026-11-25: "desde el diagrama
// unifilar se puede generar el circuito completo con sus consumidores
// finales solo para arrastrar dentro del plano ya con sus id ya
// vinculado?" — confirmado, se pidió construirlo. Un solo click genera
// un marcador por CADA equipo real de un circuito elegido, cada uno YA
// vinculado a su propio equipo (sin pasar por "Vincular a") y con el
// símbolo correcto ya inferido — apilados cerca del click, listos para
// arrastrar cada uno a su posición real con "Mover equipo".
import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto(process.env.BASE_URL || "http://localhost:4343", { waitUntil: "networkidle" });

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

async function puntoPantallaDesdeImagen(puntoImagen) {
  const svg = page.locator("svg").last();
  const box = await svg.boundingBox();
  const transformAttr = await page.locator("svg > g").last().getAttribute("transform");
  const m = transformAttr.match(/translate\(([-\d.]+),([-\d.]+)\) scale\(([-\d.]+)\)/);
  const panX = parseFloat(m[1]), panY = parseFloat(m[2]), zoom = parseFloat(m[3]);
  return { x: box.x + puntoImagen.x * zoom + panX, y: box.y + puntoImagen.y * zoom + panY };
}

// --- 0. Un circuito con 2 equipos reales: una luminaria y un
//     tomacorriente, para que se infieran símbolos distintos. ---
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Ej: Iluminación cocina").fill("Circuito prueba generar");
await page.locator("label", { hasText: "Distancia (m)" }).locator("xpath=following-sibling::input[1]").fill("10");
await page.getByRole("button", { name: "+ Crear circuito" }).click();
await page.waitForTimeout(200);

await page.getByPlaceholder("Ej: Refrigerador").fill("Lámpara pasillo");
await page.locator("label", { hasText: "P unitaria (W)" }).locator("xpath=following-sibling::input[1]").fill("15");
await page.getByRole("button", { name: "+ Agregar equipo" }).click();
await page.waitForTimeout(200);

await page.getByPlaceholder("Ej: Refrigerador").fill("Tomacorriente pasillo");
await page.locator("label", { hasText: "P unitaria (W)" }).locator("xpath=following-sibling::input[1]").fill("180");
await page.getByRole("button", { name: "+ Agregar equipo" }).click();
await page.waitForTimeout(200);

// Un 2do circuito vacío (sin equipos todavía) — para probar el aviso de "sin equipos".
await page.getByPlaceholder("Ej: Iluminación cocina").fill("Circuito vacío");
await page.locator("label", { hasText: "Distancia (m)" }).locator("xpath=following-sibling::input[1]").fill("5");
await page.getByRole("button", { name: "+ Crear circuito" }).click();
await page.waitForTimeout(200);

// --- 1. Ir a Plano, cargar imagen, calibrar ---
await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Plano", exact: true }).click();
await page.waitForTimeout(300);
const panelPlano = page.getByText("Plano inteligente", { exact: true }).locator("xpath=../../..");

await page.locator('input[type="file"][accept="image/*,application/pdf"]').setInputFiles(DIR + "fixtures/plano_test.png");
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Calibrar", exact: true }).click();
await page.waitForTimeout(150);
let p = await puntoPantallaDesdeImagen({ x: 100, y: 100 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(100);
p = await puntoPantallaDesdeImagen({ x: 500, y: 100 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(150);
await page.getByPlaceholder("Ej: 5").fill("5");
await page.getByRole("button", { name: "Calibrar", exact: true }).last().click();
await page.waitForTimeout(200);

// --- 2. "Generar circuito": sin elegir circuito, avisa en vez de fallar en silencio ---
await page.getByRole("button", { name: "Generar circuito", exact: true }).click();
await page.waitForTimeout(150);
p = await puntoPantallaDesdeImagen({ x: 300, y: 250 });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);
assert((await page.getByText("Elegí un circuito primero.").count()) >= 1, "Sin elegir circuito, avisa en vez de fallar en silencio");
assert((await panelPlano.getByText("Equipos en el plano (0)").count()) === 1, "No se generó ningún marcador sin elegir circuito");

// --- 3. Elegir el circuito VACÍO: avisa que no tiene equipos ---
const selectCircuito = page.locator("select").filter({ has: page.locator('option:has-text("¿Qué circuito?")') });
assert((await selectCircuito.locator("option").allTextContents()).some((t) => t.includes("Circuito prueba generar") && t.includes("2 equipos")), "El circuito con 2 equipos aparece correctamente contado");
await selectCircuito.selectOption({ label: await selectCircuito.locator("option").filter({ hasText: "Circuito vacío" }).textContent() });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);
assert((await page.getByText(/todavía no tiene equipos cargados/).count()) >= 1, "Avisa que el circuito elegido no tiene equipos");

// --- 4. Elegir el circuito con 2 equipos: genera 2 marcadores YA
//     vinculados, con el símbolo correcto cada uno. ---
await selectCircuito.selectOption({ label: await selectCircuito.locator("option").filter({ hasText: "Circuito prueba generar" }).textContent() });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(300);

assert((await page.getByText(/2 marcador\(es\) generado\(s\), YA vinculados/).count()) >= 1, "Avisa que generó 2 marcadores ya vinculados");
assert((await panelPlano.getByText("Equipos en el plano (2)").count()) === 1, "Se crearon exactamente 2 marcadores");

const listaEquiposPlano = panelPlano.getByText(/^Equipos en el plano \(/).locator("xpath=following-sibling::div[1]");
assert((await listaEquiposPlano.getByText("Luminaria", { exact: true }).count()) === 1, "Uno de los marcadores se infirió como 'Luminaria' (por el nombre 'Lámpara pasillo')");
assert((await listaEquiposPlano.getByText("Contacto (tomacorriente)", { exact: true }).count()) === 1, "El otro se infirió como 'Contacto (tomacorriente)' (por el nombre 'Tomacorriente pasillo')");

// Cada marcador quedó vinculado a SU equipo real (no "— Sin vincular —").
const tarjetaLampara = listaEquiposPlano.locator('input[value="Lámpara pasillo"]').locator("xpath=..");
assert((await tarjetaLampara.locator("select").first().locator("option:checked").textContent()).includes("Lámpara pasillo"), "El marcador de la luminaria quedó vinculado a 'Lámpara pasillo' (sin pasar por 'Vincular a')");
const tarjetaToma = listaEquiposPlano.locator('input[value="Tomacorriente pasillo"]').locator("xpath=..");
assert((await tarjetaToma.locator("select").first().locator("option:checked").textContent()).includes("Tomacorriente pasillo"), "El marcador del tomacorriente quedó vinculado a 'Tomacorriente pasillo'");

// --- 5. Correr "Generar circuito" de NUEVO sobre el mismo circuito:
//     no duplica nada (ambos equipos ya tienen marcador). ---
await selectCircuito.selectOption({ label: await selectCircuito.locator("option").filter({ hasText: "Circuito prueba generar" }).textContent() });
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(300);
assert((await page.getByText(/ya tienen marcador en el plano — no se generó ninguno nuevo/).count()) >= 1, "Correr de nuevo sobre el mismo circuito no duplica nada — avisa en vez de generar de más");
assert((await panelPlano.getByText("Equipos en el plano (2)").count()) === 1, "Siguen siendo exactamente 2 marcadores, ninguno duplicado");

// --- 6. Deshacer revierte el LOTE completo (los 2 marcadores) en un solo paso ---
// Primero hay que volver a generarlos (se deshizo todo con la prueba
// anterior solo de verificación, no de deshacer) — en realidad el
// estado actual YA tiene los 2 marcadores del paso 4, así que deshacer
// acá debería revertir la última acción real: el intento vacío del
// paso 5 no generó nada nuevo (no hubo guardarPuntoDeshacerPlano), así
// que deshacer debería ir directo a ANTES del paso 4 (0 marcadores).
await page.getByRole("button", { name: "↶ Deshacer", exact: true }).click();
await page.waitForTimeout(200);
assert((await panelPlano.getByText("Equipos en el plano (0)").count()) === 1, "Deshacer revierte el LOTE completo de 'Generar circuito' en un solo paso");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/generar_circuito_plano.png", fullPage: true });
await browser.close();
