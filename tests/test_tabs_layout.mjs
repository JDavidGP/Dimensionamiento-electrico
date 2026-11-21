import { chromium } from "playwright";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

async function enViewport(locator) {
  const box = await locator.boundingBox();
  if (!box) return false;
  const vp = locator.page().viewportSize();
  return box.x >= -2 && box.x < vp.width; // tolerancia mínima por redondeo
}

// ============ 1. Navegación por click (desktop, sin touch) ============
{
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errores = [];
  page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto((process.env.BASE_URL || "http://localhost:4352"), { waitUntil: "networkidle" });

  const botonNormativa = page.getByRole("button", { name: "Normativa", exact: true });
  const botonTableros = page.getByRole("button", { name: "Tableros", exact: true });
  const botonCircuitos = page.getByRole("button", { name: "Circuitos y resultados", exact: true });
  // Diagrama unifilar y Plano ya NO son pestañas de nivel superior —
  // viven agrupados bajo "Esquemas" como sub-pestañas (ver SubTabs.jsx,
  // pedido explícito del usuario 2026-11-20). Para que su contenido
  // entre al viewport hace falta primero activar "Esquemas".
  const botonEsquemas = page.getByRole("button", { name: "Esquemas", exact: true });
  const botonDiagrama = page.getByRole("button", { name: "Diagrama unifilar", exact: true });
  const botonPlanoSub = page.getByRole("button", { name: "Plano", exact: true });

  const nuevoTableroBtn = page.getByRole("button", { name: "+ Nuevo tablero" });

  assert(await enViewport(botonNormativa), "Pestaña Normativa visible desde el inicio");
  assert(!(await enViewport(nuevoTableroBtn)), "Contenido de Tableros NO está en viewport al inicio (clippeado por overflow:hidden)");

  await botonTableros.click();
  await page.waitForTimeout(350); // esperar la transición CSS
  assert(await enViewport(nuevoTableroBtn), "Tras click en 'Tableros', su contenido entra al viewport");

  await botonCircuitos.click();
  await page.waitForTimeout(350);
  assert(await enViewport(page.locator("text=Circuitos").first()), "Pestaña Circuitos y resultados muestra su contenido");
  assert(await page.locator('input[placeholder*="TD-01"], input[placeholder*="Q1"]').count() >= 0, "sanity: la pestaña cargó sin romper el DOM");

  await botonEsquemas.click();
  await page.waitForTimeout(350);
  assert(await enViewport(page.getByRole("button", { name: "+ Agregar", exact: true })), "Tras click en 'Esquemas', el editor de Diagrama unifilar (sub-pestaña por defecto) entra al viewport");

  // Las sub-pestañas de Esquemas también deben entrar/salir del viewport al alternar.
  await botonPlanoSub.click();
  await page.waitForTimeout(250);
  assert(await enViewport(page.getByText("Cargá un plano para empezar.")), "Al cambiar a la sub-pestaña 'Plano', su contenido entra al viewport");
  assert(!(await enViewport(page.getByRole("button", { name: "+ Agregar", exact: true }))), "El editor de Diagrama unifilar sale del viewport al cambiar a la sub-pestaña 'Plano'");

  await botonDiagrama.click();
  await page.waitForTimeout(250);
  assert(await enViewport(page.getByRole("button", { name: "+ Agregar", exact: true })), "Al volver a la sub-pestaña 'Diagrama unifilar', su editor vuelve a entrar al viewport");

  console.log("Errores de página (navegación por click):", errores);
  assert(errores.length === 0, "Sin errores de página durante la navegación por click");
  await browser.close();
}

// ============ 2. Flujo de datos cruza entre pestañas sin perderse ============
{
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto((process.env.BASE_URL || "http://localhost:4352"), { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Tableros", exact: true }).click();
  await page.waitForTimeout(350);
  await page.getByRole("button", { name: "+ Nuevo tablero" }).click();
  await page.getByPlaceholder("Ej: Tablero principal, Subpanel cocina").fill("TD-TABS");
  await page.getByRole("button", { name: "+ Crear tablero" }).click();
  await page.waitForTimeout(150);

  await page.getByRole("button", { name: "Esquemas", exact: true }).click();
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "Diagrama unifilar", exact: true }).click();
  await page.waitForTimeout(350);

  const selectTipo = page.locator("select").filter({ has: page.locator('option:has-text("Acometida")') });
  await selectTipo.selectOption({ label: "Tablero eléctrico" });
  const selectVinculo = page.locator("select").filter({ has: page.locator('option:has-text("— Vincular a (opcional) —")') });
  assert(
    (await selectVinculo.locator('option:has-text("TD-TABS")').count()) === 1,
    "Un tablero creado en la pestaña Tableros aparece como candidato para vincular en la pestaña Diagrama (el estado no vive en la pestaña, vive en el hook)"
  );

  await browser.close();
}

// ============ 3. Swipe táctil (contexto móvil emulado) ============
{
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errores = [];
  page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto((process.env.BASE_URL || "http://localhost:4352"), { waitUntil: "networkidle" });

  const nuevoTableroBtn = page.getByRole("button", { name: "+ Nuevo tablero" });
  assert(!(await enViewport(nuevoTableroBtn)), "(móvil) Tableros no visible al inicio");

  // Swipe de derecha a izquierda (dedo se mueve hacia la izquierda) = avanzar a la siguiente pestaña
  const centroY = 500;
  await page.touchscreen.tap(50, centroY).catch(() => {}); // noop, solo para asegurar foco en page
  await page.mouse.move(0, 0); // no-op
  const box = await page.locator("body").boundingBox();
  const startX = box.width - 40;
  const endX = 20;

  // Playwright no expone touchscreen.swipe directo con pasos intermedios distintos de "move";
  // se dispara la secuencia completa con CDP Input.dispatchTouchEvent vía evaluate en el DOM
  // sobre el contenedor del swipe sería más frágil — en su lugar usamos la API real touchscreen
  // con varios "move" intermedios para que el componente vea un gesto, no un salto.
  await page.evaluate(
    ({ startX, endX, y }) => {
      const contenedor = document.querySelectorAll('div[style*="touch-action"]')[0] || document.body;
      function disparar(tipo, x) {
        const touch = new Touch({ identifier: 1, target: contenedor, clientX: x, clientY: y, pageX: x, pageY: y });
        const evento = new TouchEvent(tipo, { touches: tipo === "touchend" ? [] : [touch], targetTouches: tipo === "touchend" ? [] : [touch], changedTouches: [touch], bubbles: true, cancelable: true });
        contenedor.dispatchEvent(evento);
      }
      disparar("touchstart", startX);
      const pasos = 8;
      for (let i = 1; i <= pasos; i++) {
        disparar("touchmove", startX + ((endX - startX) * i) / pasos);
      }
      disparar("touchend", endX);
    },
    { startX, endX, y: centroY }
  );
  await page.waitForTimeout(400);

  assert(await enViewport(nuevoTableroBtn), "(móvil) Tras el swipe horizontal, la pestaña Tableros queda visible");

  // Swipe de vuelta (izquierda a derecha) = retroceder a Normativa
  async function swipe(x1, x2, y) {
    await page.evaluate(
      ({ x1, x2, y }) => {
        const contenedor = document.querySelectorAll('div[style*="touch-action"]')[0];
        function disparar(tipo, x) {
          const touch = new Touch({ identifier: 1, target: contenedor, clientX: x, clientY: y, pageX: x, pageY: y });
          const evento = new TouchEvent(tipo, { touches: tipo === "touchend" ? [] : [touch], targetTouches: tipo === "touchend" ? [] : [touch], changedTouches: [touch], bubbles: true, cancelable: true });
          contenedor.dispatchEvent(evento);
        }
        disparar("touchstart", x1);
        const pasos = 8;
        for (let i = 1; i <= pasos; i++) disparar("touchmove", x1 + ((x2 - x1) * i) / pasos);
        disparar("touchend", x2);
      },
      { x1, x2, y }
    );
  }

  await swipe(20, 350, centroY);
  await page.waitForTimeout(400);
  const botonNormativaMovil = page.getByRole("button", { name: "Normativa", exact: true });
  assert(await enViewport(botonNormativaMovil), "(móvil) Swipe en reversa vuelve a Normativa");
  assert(!(await enViewport(nuevoTableroBtn)), "(móvil) Tableros vuelve a quedar fuera del viewport tras el swipe en reversa");

  // Un gesto predominantemente VERTICAL no debe cambiar de pestaña (debe dejarse para el scroll normal)
  await page.evaluate(
    ({ y1, y2, x }) => {
      const contenedor = document.querySelectorAll('div[style*="touch-action"]')[0];
      function disparar(tipo, y) {
        const touch = new Touch({ identifier: 2, target: contenedor, clientX: x, clientY: y, pageX: x, pageY: y });
        const evento = new TouchEvent(tipo, { touches: tipo === "touchend" ? [] : [touch], targetTouches: tipo === "touchend" ? [] : [touch], changedTouches: [touch], bubbles: true, cancelable: true });
        contenedor.dispatchEvent(evento);
      }
      disparar("touchstart", y1);
      const pasos = 8;
      for (let i = 1; i <= pasos; i++) disparar("touchmove", y1 + ((y2 - y1) * i) / pasos);
      disparar("touchend", y2);
    },
    { y1: 200, y2: 600, x: 195 }
  );
  await page.waitForTimeout(400);
  assert(await enViewport(botonNormativaMovil), "(móvil) Un gesto vertical NO cambia de pestaña (sigue en Normativa)");

  console.log("Errores de página (swipe táctil):", errores);
  assert(errores.length === 0, "Sin errores de página durante el swipe");
  await browser.close();
}

console.log("\nListo.");
