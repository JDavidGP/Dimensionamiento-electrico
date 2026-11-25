// Reseteo de estado entre dos análisis consecutivos — usuario,
// 2026-11-25 (captura real): analizó un documento LARGO (truncado,
// avisa "el documento es largo") y después, sin cerrar el panel, uno
// CORTO — el aviso de "documento largo" quedó pegado de la corrida
// anterior, visible incluso mientras la nueva corrida (del documento
// corto) todavía estaba en curso. Causa: `analizar()` reseteaba
// error/resultado/avisoFinal al EMPEZAR una corrida nueva, pero
// truncado/avisos solo se actualizaban al TERMINAR una con éxito —
// nunca se limpiaban al empezar la siguiente.
import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

// Respuesta mínima válida — el contenido no importa para esta prueba
// (es sobre el aviso de truncado, no sobre qué devuelve la IA).
const jsonExtraido = { tableros: [{ nombre: "TD1", tension_v: 120, fases: "mono", longitud_alimentador_m: null, circuitos: [{ descripcion: "Circuito de prueba", potencia_w: 500, corriente_a: null, voltaje_v: 120, fases: "mono" }] }] };
await page.route("**/api/generate", (route) => {
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ response: JSON.stringify(jsonExtraido) }) });
});

await page.goto((process.env.BASE_URL || "http://localhost:4353"), { waitUntil: "networkidle" });

await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);
await page.getByText("¿Tenés una memoria técnica en PDF? Importar con IA local (experimental)").click();
await page.waitForTimeout(150);

// --- 1. Analizar el documento LARGO (>12000 caracteres de texto real) — debe avisar "documento largo". ---
await page.setInputFiles('input[type="file"][accept="application/pdf"]', DIR + "fixtures/memoria_tecnica_larga_test.pdf");
await page.getByRole("button", { name: "Analizar con IA local" }).click();
await page.waitForTimeout(1000);
assert((await page.getByText(/El documento es largo/).count()) === 1, "Documento largo: avisa que se truncó");

// --- 2. Analizar el documento CORTO (el fixture ya existente, muy por
//     debajo del límite) — el aviso de "documento largo" debe
//     DESAPARECER, no quedar pegado de la corrida anterior. ---
await page.setInputFiles('input[type="file"][accept="application/pdf"]', DIR + "fixtures/memoria_tecnica_test.pdf");
await page.getByRole("button", { name: "Analizar con IA local" }).click();
// Se verifica INMEDIATAMENTE después del click (antes de que la corrida
// termine) — el bug reportado era visible JUSTO en ese momento, con
// "Analizando..." y el aviso viejo mostrados a la vez.
await page.waitForTimeout(50);
assert((await page.getByText(/El documento es largo/).count()) === 0, "Documento corto: el aviso de 'documento largo' de la corrida ANTERIOR ya no aparece, ni siquiera mientras la nueva corrida está en curso");

await page.waitForTimeout(1000);
assert((await page.getByText(/El documento es largo/).count()) === 0, "Documento corto: tampoco aparece una vez terminado el análisis");
assert((await page.getByText("Circuito de prueba").count()) === 1, "El análisis del documento corto completó normalmente");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await browser.close();
