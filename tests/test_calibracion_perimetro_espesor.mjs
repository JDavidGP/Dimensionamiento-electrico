// Calibración por perímetro + espesor de pared (usuario, 2026-11-20).
import { ApplicationMediator as App } from "../src/core/ApplicationMediator.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

// --- 1. Calibración por perímetro: cuadrado de 400x400 px, perímetro real 60m ---
const contornoCuadrado = [
  { x: 0, y: 0 },
  { x: 400, y: 0 },
  { x: 400, y: 400 },
  { x: 0, y: 400 },
];
// Perímetro en píxeles del cuadrado cerrado: 4 * 400 = 1600px.
const resultado = App.plano.calcularEscalaPorPerimetro(contornoCuadrado, 60);
assert(resultado.ok === true, "Calibración por perímetro OK con un contorno válido");
assert(Math.abs(resultado.calibracion.escalaMetrosPorPixel - 60 / 1600) < 1e-9, `Escala = perímetro real / perímetro en píxeles (real: ${resultado.calibracion.escalaMetrosPorPixel})`);
assert(resultado.calibracion.metodo === "perimetro", "El resultado trae metodo:'perimetro' para distinguirlo del de 2 puntos");

// --- 2. Menos de 3 puntos: rechazado ---
const rechazo1 = App.plano.calcularEscalaPorPerimetro([{ x: 0, y: 0 }, { x: 10, y: 0 }], 60);
assert(rechazo1.ok === false, "Menos de 3 puntos se rechaza, no se inventa un contorno");

// --- 3. Perímetro real <= 0: rechazado ---
const rechazo2 = App.plano.calcularEscalaPorPerimetro(contornoCuadrado, 0);
assert(rechazo2.ok === false, "Perímetro real <= 0 se rechaza");

// --- 4. Puntos coincidentes (perímetro en píxeles = 0): rechazado, no división por cero ---
const rechazo3 = App.plano.calcularEscalaPorPerimetro([{ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 5 }], 60);
assert(rechazo3.ok === false, "Contorno sin longitud (puntos coincidentes) se rechaza, no explota");

// --- 5. calcularEscala (2 puntos) sigue trayendo metodo:'dos_puntos' ---
const dosPuntos = App.plano.calcularEscala({ x: 0, y: 0 }, { x: 100, y: 0 }, 5);
assert(dosPuntos.ok === true && dosPuntos.calibracion.metodo === "dos_puntos", "La calibración de 2 puntos sigue funcionando igual, ahora con metodo:'dos_puntos'");

// --- 6. editarSegmento: aplica cambios sin mutar el original ---
const segmento = App.plano.crearSegmento("n1", "n2", "pared");
assert(segmento.espesorM === "", "Un segmento nuevo arranca sin espesor medido (\"\", no se inventa un valor)");
const editado = App.plano.editarSegmento(segmento, { espesorM: 0.15 });
assert(editado.espesorM === 0.15, "editarSegmento aplica el espesor");
assert(segmento.espesorM === "", "El segmento original no se muta");
assert(editado.id === segmento.id && editado.nodoAId === segmento.nodoAId, "El resto de los campos se conserva");

console.log("\nTodas las pruebas completadas.");
