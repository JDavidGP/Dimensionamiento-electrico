import { chromium } from "playwright";
import { fileURLToPath } from "url";
const DIR = fileURLToPath(new URL(".", import.meta.url));

// Importación de proyecto desde PDF con IA local (2026-11-23) — usuario
// probó la app con memorias técnicas reales y pidió que DEC reconociera
// datos de documentos de terceros, usando una IA self-hosted (Ollama)
// para no depender de ni mandar nada a un servicio en la nube. Esta
// prueba NO depende de tener Ollama corriendo (sería no-determinístico
// en CI) — intercepta la llamada a /api/generate y contesta con una
// respuesta fija, probando el resto del pipeline real: extracción de
// texto del PDF, saneo/validación del JSON, adaptación a
// circuito/equipo reales, vista previa, e importación real al proyecto
// (circuitos calculados de verdad por el motor, no un camino paralelo).

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

const jsonExtraido = {
  tableros: [
    {
      nombre: "TD1",
      tension_v: 120,
      fases: "mono",
      circuitos: [
        { descripcion: "Iluminación dormitorios", corriente_a: 15, voltaje_v: 120, fases: "mono" },
        { descripcion: "Tomacorrientes cocina", corriente_a: 20, voltaje_v: null, fases: null },
        // Corriente absurda (fuera de todo rango físico posible) — debe
        // sanearse a null, NUNCA usarse tal cual (ver esquema.ts).
        { descripcion: "Circuito fantasma", corriente_a: 999999, voltaje_v: 120, fases: "mono" },
      ],
    },
  ],
};

await page.route("**/api/generate", (route) => {
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ response: JSON.stringify(jsonExtraido) }) });
});

await page.goto((process.env.BASE_URL || "http://localhost:4353"), { waitUntil: "networkidle" });

await page.getByRole("button", { name: "Tableros", exact: true }).click();
await page.waitForTimeout(300);
await page.getByText("¿Tenés una memoria técnica en PDF? Importar con IA local (experimental)").click();
await page.waitForTimeout(150);

// --- 1. Analizar: el panel de vista previa debe aparecer con los 3 circuitos ---
await page.setInputFiles('input[type="file"][accept="application/pdf"]', DIR + "fixtures/memoria_tecnica_test.pdf");
await page.getByRole("button", { name: "Analizar con IA local" }).click();
await page.waitForTimeout(1000);

assert((await page.getByText("Iluminación dormitorios").count()) === 1, "El circuito con todos los datos aparece en la vista previa");
assert((await page.getByText(/Sin voltaje en el documento/).count()) === 1, "Avisa que el voltaje faltante se rellenó por defecto");
assert((await page.getByText(/Sin corriente en el documento/).count()) === 1, "La corriente fuera de rango se sanea a 'sin corriente', no se usa tal cual");
assert((await page.getByText("999999").count()) === 0, "El valor absurdo de corriente NUNCA se muestra tal cual (se saneó)");

// --- 2. Importar: debe crear 1 tablero y 3 circuitos reales en el proyecto ---
const botonImportar = page.getByRole("button", { name: /Importar \d+ tablero/ });
assert((await botonImportar.textContent()) === "Importar 1 tablero, 3 circuitos", `El botón resume la cantidad correcta (real: '${await botonImportar.textContent()}')`);
await botonImportar.click();
await page.waitForTimeout(300);

assert((await page.getByText(/Importado: 1 tablero, 3 circuitos/).count()) === 1, "Aviso de importación exitosa");
assert((await page.getByText("TD1").count()) >= 1, "El tablero TD1 quedó creado en la lista de tableros");

// --- 3. Los circuitos importados calculan de verdad (mismo motor que uno manual) ---
await page.getByRole("button", { name: "Circuitos y resultados", exact: true }).click();
await page.waitForTimeout(300);

assert((await page.getByText(/I=15\.00A/).count()) === 1, "El circuito de 15A calculó su corriente real vía el motor (no un valor pegado)");
assert((await page.getByText(/I=20\.00A/).count()) === 1, "El circuito de 20A calculó su corriente real vía el motor");
// >=1, no ===1: TabsViewPager mantiene todas las pestañas montadas a
// la vez (Informe técnico también refleja el mismo error de este
// circuito) — mismo criterio que el resto de la suite para texto no
// acotado a un contenedor específico.
assert((await page.getByText(/El circuito no tiene equipos asignados/).count()) >= 1, "El circuito sin corriente válida queda SIN equipo inventado (honesto, no se inventa una carga)");

// --- 4. El diagrama unifilar se arma solo: Acometida → tablero → cada
//     equipo importado (usuario, 2026-11-23, "etiquetado referencial
//     para agilizar todo") — nunca para el circuito sin equipo ---
await page.getByRole("button", { name: "Esquemas", exact: true }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Diagrama unifilar", exact: true }).click();
await page.waitForTimeout(300);

const svgDiagrama = page.locator("svg").last();
assert((await svgDiagrama.getByText("Acometida").count()) === 1, "Se creó el nodo Acometida");
assert((await svgDiagrama.getByText("TD1").count()) === 1, "Se creó el nodo del tablero, vinculado por nombre real");
// El SVG trunca nombres largos con "…" (ver DiagramaSvgContenido.jsx) — se
// matchea el prefijo, no la frase completa.
assert((await svgDiagrama.getByText(/Iluminación dor/).count()) === 1, "Nodo de carga para el equipo del primer circuito");
assert((await svgDiagrama.getByText(/Tomacorrientes/).count()) === 1, "Nodo de carga para el equipo del segundo circuito");
assert((await svgDiagrama.getByText(/Circuito fantasma/).count()) === 0, "El circuito SIN equipo (corriente inválida) no genera un nodo de carga inventado");
assert((await svgDiagrama.locator("text", { hasText: "vinculado" }).count()) === 3, "Los 3 nodos (tablero + 2 equipos) quedan vinculados a su entidad real, ninguno suelto");

console.log("\nErrores de página:", errores);
assert(errores.length === 0, "Sin errores de página en todo el flujo");

await page.screenshot({ path: DIR + "tmp/importar_pdf_ia.png", fullPage: true });
await browser.close();
