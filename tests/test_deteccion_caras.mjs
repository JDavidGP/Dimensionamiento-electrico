// Detección de TODAS las caras (ambientes) de un grafo de paredes —
// deuda técnica del README ("Detección de habitaciones limitada a
// lazos que cierran sobre su propio punto de inicio", usuario,
// 2026-11-25: "continuemos con alguna deuda técnica que podría
// haber"). Prueba la capa PURA: detectarCaras (modules/plano/).
import { detectarCaras } from "../src/modules/plano/deteccionCaras.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

function nodo(id, x, y) {
  return { id, punto: { x, y } };
}
function pared(id, nodoAId, nodoBId) {
  return { id, nodoAId, nodoBId, tipo: "pared", espesorM: "" };
}
function idsOrdenados(cara) {
  return [...cara.nodoIds].sort().join(",");
}

// --- 1. Cuadrado simple (1 sola cara acotada, la exterior se descarta) ---
const nodosCuadrado = [nodo("A", 0, 0), nodo("B", 10, 0), nodo("C", 10, 10), nodo("D", 0, 10)];
const paredesCuadrado = [pared("p1", "A", "B"), pared("p2", "B", "C"), pared("p3", "C", "D"), pared("p4", "D", "A")];
const carasCuadrado = detectarCaras(nodosCuadrado, paredesCuadrado);
assert(carasCuadrado.length === 1, `Cuadrado simple -> exactamente 1 cara acotada (real: ${carasCuadrado.length})`);
if (carasCuadrado.length === 1) {
  assert(Math.abs(carasCuadrado[0].areaM2 - 100) < 1e-9, `Área del cuadrado = 100 m² (real: ${carasCuadrado[0].areaM2})`);
  assert(idsOrdenados(carasCuadrado[0]) === "A,B,C,D", `La cara tiene los 4 nodos del cuadrado (real: ${idsOrdenados(carasCuadrado[0])})`);
}

// --- 2. Rectángulo 20×10 partido al medio por una pared interior M-N
//     (M en el medio de A-B, N en el medio de D-C) -> 2 ambientes de
//     10×10 cada uno, SIN una 3ra cara espuria (la exterior, de 6
//     lados, debe descartarse). Este es el caso concreto que el README
//     señala como no soportado antes: "un grafo planar con varias
//     caras" sin volver al punto de inicio de cada una por separado. ---
const nodosPartido = [nodo("A", 0, 0), nodo("M", 10, 0), nodo("B", 20, 0), nodo("C", 20, 10), nodo("N", 10, 10), nodo("D", 0, 10)];
const paredesPartido = [
  pared("p1", "A", "M"),
  pared("p2", "M", "B"),
  pared("p3", "B", "C"),
  pared("p4", "C", "N"),
  pared("p5", "N", "D"),
  pared("p6", "D", "A"),
  pared("p7", "M", "N"), // pared interior
];
const carasPartido = detectarCaras(nodosPartido, paredesPartido);
assert(carasPartido.length === 2, `Rectángulo partido al medio -> exactamente 2 ambientes (real: ${carasPartido.length})`);
const areasPartido = carasPartido.map((c) => c.areaM2).sort((a, b) => a - b);
assert(areasPartido.every((a) => Math.abs(a - 100) < 1e-9), `Los 2 ambientes miden 100 m² cada uno (10×10) (real: ${JSON.stringify(areasPartido)})`);
const idsPartido = carasPartido.map(idsOrdenados).sort();
assert(idsPartido[0] === "A,D,M,N" && idsPartido[1] === "B,C,M,N", `Los 2 ambientes son exactamente [A,D,M,N] (izquierda) y [B,C,M,N] (derecha) (real: ${JSON.stringify(idsPartido)})`);

// --- 3. Callejón sin salida (un segmento de pared que no cierra nada)
//     no debe producir ninguna cara, ni reventar. ---
const nodosConColgante = [...nodosCuadrado, nodo("E", 15, 15)];
const paredesConColgante = [...paredesCuadrado, pared("p5", "C", "E")];
const carasConColgante = detectarCaras(nodosConColgante, paredesConColgante);
assert(carasConColgante.length === 1, `Un callejón sin salida colgando del cuadrado no agrega ni rompe la única cara real (real: ${carasConColgante.length})`);

// --- 4. Dos cuadrados totalmente separados (sin tocarse) -> 2 caras,
//     cada una con su propia exterior descartada por separado. ---
const nodosDosCuartos = [
  nodo("A", 0, 0), nodo("B", 10, 0), nodo("C", 10, 10), nodo("D", 0, 10),
  nodo("E", 100, 100), nodo("F", 105, 100), nodo("G", 105, 105), nodo("H", 100, 105),
];
const paredesDosCuartos = [
  pared("p1", "A", "B"), pared("p2", "B", "C"), pared("p3", "C", "D"), pared("p4", "D", "A"),
  pared("p5", "E", "F"), pared("p6", "F", "G"), pared("p7", "G", "H"), pared("p8", "H", "E"),
];
const carasDosCuartos = detectarCaras(nodosDosCuartos, paredesDosCuartos);
assert(carasDosCuartos.length === 2, `Dos cuartos separados -> 2 caras acotadas, una por cada uno (real: ${carasDosCuartos.length})`);
const areasDosCuartos = carasDosCuartos.map((c) => c.areaM2).sort((a, b) => a - b);
assert(Math.abs(areasDosCuartos[0] - 25) < 1e-9 && Math.abs(areasDosCuartos[1] - 100) < 1e-9, `Áreas correctas: 5×5=25 y 10×10=100 (real: ${JSON.stringify(areasDosCuartos)})`);

// --- 5. Un segmento tipo "conductor" entre 2 esquinas NO cuenta como
//     pared -> no debe partir el cuadrado en 2. ---
const paredesConConductor = [...paredesCuadrado, { id: "cond1", nodoAId: "A", nodoBId: "C", tipo: "conductor", espesorM: "" }];
const carasConConductor = detectarCaras(nodosCuadrado, paredesConConductor);
assert(carasConConductor.length === 1, `Un 'conductor' que cruza el cuadrado no define ambientes (solo 'pared' lo hace) (real: ${carasConConductor.length})`);

// --- 6. Sin paredes (o menos de 3) -> [] sin reventar. ---
assert(detectarCaras([], []).length === 0, "Sin nodos/paredes -> []");
assert(detectarCaras(nodosCuadrado, [pared("p1", "A", "B")]).length === 0, "Una sola pared (no puede cerrar nada) -> []");

console.log("\nTodas las pruebas de detectarCaras ejecutadas.");
