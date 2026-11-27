// Enganche automático de "Mover ambiente" (plano rompecabezas) —
// usuario, 2026-11-25: deuda técnica dejada a propósito al construir
// "plano sin imagen" v1 ("Sin enganche automático primero"), ahora se
// salda. Prueba pura, sin navegador (geometría de modules/plano/
// enganchePuzzle.ts) — la verificación en vivo contra la UI real va en
// test_enganche_puzzle_ui.mjs.
import { ApplicationMediator as App } from "../src/core/ApplicationMediator.ts";

let fallos = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FALLÓ:", msg); fallos++; }
  else console.log("OK:", msg);
}

const RADIO = App.plano.RADIO_SNAP_METROS; // 0.3

// --- cajaDeHabitacion ---
const nodos = [
  { id: "a", punto: { x: 0, y: 0 } },
  { id: "b", punto: { x: 4, y: 0 } },
  { id: "c", punto: { x: 4, y: 3 } },
  { id: "d", punto: { x: 0, y: 3 } },
];
const habitacion = { id: "h1", nodoIds: ["a", "b", "c", "d"], nombre: "Sala", areaM2: 12, perimetroM: 14, alturaM: null };
const caja = App.plano.cajaDeHabitacion(habitacion, nodos);
assert(caja.xMin === 0 && caja.xMax === 4 && caja.yMin === 0 && caja.yMax === 3, "Caja envolvente de un rectángulo 4x3: calcula bien los 4 bordes");
assert(App.plano.cajaDeHabitacion({ id: "x", nodoIds: ["no-existe"] }, nodos) === null, "Sin ningún nodo resoluble, devuelve null (no inventa una caja)");

// --- calcularDeltaConEnganche: sin ningún candidato cerca, arrastre libre ---
const sinReferencias = App.plano.calcularDeltaConEnganche(caja, { x: 1, y: 1 }, [], RADIO);
assert(sinReferencias.x === 1 && sinReferencias.y === 1, "Sin cajas de referencia: el delta no se toca (arrastre libre)");

const lejos = App.plano.calcularDeltaConEnganche(caja, { x: 1, y: 1 }, [{ xMin: 20, xMax: 24, yMin: 20, yMax: 23 }], RADIO);
assert(lejos.x === 1 && lejos.y === 1, "Candidato muy lejos (fuera del radio): no engancha, delta sin tocar");

// --- Enganche "borde a borde" (dos piezas de rompecabezas que se tocan) ---
// Ambiente de al lado: x de 4.05 a 8, y de 0 a 3 — el borde derecho del
// ambiente arrastrado (xMax=4) quedaría a 0.05m del borde izquierdo del
// vecino (dentro del radio de 0.3m) con delta.x=0 — debe ajustarse a 0.05 exacto.
const vecinoDerecha = { xMin: 4.05, xMax: 8, yMin: 0, yMax: 3 };
const engancheDerecha = App.plano.calcularDeltaConEnganche(caja, { x: 0, y: 0 }, [vecinoDerecha], RADIO);
assert(Math.abs(engancheDerecha.x - 0.05) < 1e-9, `Engancha el borde derecho contra el izquierdo del vecino (real: ${engancheDerecha.x})`);
assert(engancheDerecha.y === 0, "El eje Y no tiene candidato cerca — no se toca");

// --- Enganche "mismo lado" (alinear dos paredes, no necesariamente tocándose) ---
// Vecino con un yMax bien distinto (10, fuera de cualquier radio) para
// que la ÚNICA coincidencia posible dentro del radio sea yMin con yMin.
const vecinoAlineado = { xMin: 10, xMax: 14, yMin: 0.08, yMax: 10 };
const engancheAlineado = App.plano.calcularDeltaConEnganche(caja, { x: 0, y: 0 }, [vecinoAlineado], RADIO);
assert(Math.abs(engancheAlineado.y - 0.08) < 1e-9, `Engancha alineando el mismo borde (yMin con yMin), no solo borde-a-borde (real: ${engancheAlineado.y})`);

// --- Enganche contra el marco del plano (no solo contra otros ambientes) ---
const marco = { xMin: 0, xMax: 10, yMin: 0, yMax: 8 };
const cajaDesplazada = { xMin: -0.1, xMax: 3.9, yMin: 2, yMax: 5 }; // su xMin (-0.1) ya casi toca el marco (xMin=0)
const engancheMarco = App.plano.calcularDeltaConEnganche(cajaDesplazada, { x: 0, y: 0 }, [marco], RADIO);
assert(Math.abs(engancheMarco.x - 0.1) < 1e-9, `Engancha contra el borde del marco igual que contra otro ambiente (real: ${engancheMarco.x})`);

// --- Gana el candidato MÁS CERCANO, no cualquiera dentro del radio ---
const cercano = { xMin: 4.05, xMax: 8, yMin: 0, yMax: 3 }; // ajuste necesario: 0.05
const lejanoPeroDentroDelRadio = { xMin: 4.25, xMax: 9, yMin: 0, yMax: 3 }; // ajuste necesario: 0.25, también < 0.3
const engancheElige = App.plano.calcularDeltaConEnganche(caja, { x: 0, y: 0 }, [lejanoPeroDentroDelRadio, cercano], RADIO);
assert(Math.abs(engancheElige.x - 0.05) < 1e-9, `Con 2 candidatos dentro del radio, elige el que pide el ajuste más chico (real: ${engancheElige.x})`);

// --- Radio exacto: justo en el límite SÍ engancha (<=), más allá NO ---
const enElLimite = { xMin: 4.3, xMax: 8, yMin: 0, yMax: 3 }; // ajuste exacto 0.3 = RADIO
const justoDentro = App.plano.calcularDeltaConEnganche(caja, { x: 0, y: 0 }, [enElLimite], RADIO);
assert(Math.abs(justoDentro.x - 0.3) < 1e-9, "Un candidato justo en el límite del radio (0.3m) SÍ engancha");

const pasandoElLimite = { xMin: 4.31, xMax: 8, yMin: 0, yMax: 3 };
const justoAfuera = App.plano.calcularDeltaConEnganche(caja, { x: 0, y: 0 }, [pasandoElLimite], RADIO);
assert(justoAfuera.x === 0, "Un candidato apenas más allá del radio (0.31m) NO engancha");

// --- No muta los parámetros de entrada ---
const cajaOriginalJSON = JSON.stringify(caja);
App.plano.calcularDeltaConEnganche(caja, { x: 5, y: 5 }, [vecinoDerecha], RADIO);
assert(JSON.stringify(caja) === cajaOriginalJSON, "No muta la caja de entrada (función pura)");

console.log(fallos === 0 ? "\nTODOS LOS CHECKS PASARON" : `\n${fallos} CHECK(S) FALLARON`);
process.exit(fallos === 0 ? 0 : 1);
