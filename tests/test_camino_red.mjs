// Camino más corto sobre la red de conductores — usuario, 2026-11-25,
// "Sugerir ruta automática". Prueba la capa PURA: caminoMasCorto
// (modules/plano/caminoRed.ts).
import { caminoMasCorto } from "../src/modules/plano/caminoRed.ts";

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

function nodo(id, x, y) {
  return { id, punto: { x, y } };
}
function conductor(id, nodoAId, nodoBId) {
  return { id, nodoAId, nodoBId, tipo: "conductor", espesorM: "" };
}
function pared(id, nodoAId, nodoBId) {
  return { id, nodoAId, nodoBId, tipo: "pared", espesorM: "" };
}

// --- 1. Cadena simple A-B-C: el camino es la suma de los 2 tramos ---
const nodosCadena = [nodo("A", 0, 0), nodo("B", 3, 0), nodo("C", 3, 4)];
const segmentosCadena = [conductor("s1", "A", "B"), conductor("s2", "B", "C")];
const r1 = caminoMasCorto("A", "C", nodosCadena, segmentosCadena);
assert(r1 !== null, "Encuentra camino en una cadena simple");
assert(JSON.stringify(r1.nodoIds) === JSON.stringify(["A", "B", "C"]), `El camino pasa por A,B,C en orden (real: ${JSON.stringify(r1?.nodoIds)})`);
assert(Math.abs(r1.longitudM - 7) < 1e-9, `Longitud = 3+4 = 7m (real: ${r1.longitudM})`);

// --- 2. Dos caminos posibles: elige el MÁS CORTO, no el primero que encuentra ---
// A-B-D (directo, corto) y A-C-D (rodeo, largo).
const nodosDosCaminos = [nodo("A", 0, 0), nodo("B", 1, 0), nodo("D", 2, 0), nodo("C", 1, 10)];
const segmentosDosCaminos = [
  conductor("corto1", "A", "B"),
  conductor("corto2", "B", "D"),
  conductor("largo1", "A", "C"),
  conductor("largo2", "C", "D"),
];
const r2 = caminoMasCorto("A", "D", nodosDosCaminos, segmentosDosCaminos);
assert(JSON.stringify(r2.nodoIds) === JSON.stringify(["A", "B", "D"]), `Elige el camino corto A-B-D, no el rodeo A-C-D (real: ${JSON.stringify(r2?.nodoIds)})`);
assert(Math.abs(r2.longitudM - 2) < 1e-9, `Longitud del camino corto = 2m, no ~22m del rodeo (real: ${r2.longitudM})`);

// --- 3. Sin camino (grafo desconectado) -> null, nunca inventa una línea recta ---
const nodosDesconectados = [nodo("A", 0, 0), nodo("B", 1, 0), nodo("X", 100, 100), nodo("Y", 101, 100)];
const segmentosDesconectados = [conductor("s1", "A", "B"), conductor("s2", "X", "Y")];
assert(caminoMasCorto("A", "Y", nodosDesconectados, segmentosDesconectados) === null, "Sin camino en la red -> null (no inventa una conexión)");

// --- 4. Origen === destino -> camino trivial de longitud 0 ---
const r4 = caminoMasCorto("A", "A", nodosCadena, segmentosCadena);
assert(r4 !== null && r4.longitudM === 0 && JSON.stringify(r4.nodoIds) === JSON.stringify(["A"]), "Origen igual a destino -> camino trivial de longitud 0");

// --- 5. Solo segmentos "conductor" cuentan — una "pared" entre 2 nodos NO es un camino válido ---
const nodosParedSola = [nodo("A", 0, 0), nodo("B", 5, 0)];
const segmentosParedSola = [pared("p1", "A", "B")];
assert(caminoMasCorto("A", "B", nodosParedSola, segmentosParedSola) === null, "Una pared sola NO es un camino válido para un conductor");

// --- 6. Nodo inexistente -> null, no revienta ---
assert(caminoMasCorto("A", "NO_EXISTE", nodosCadena, segmentosCadena) === null, "Un id de nodo inexistente -> null, sin reventar");

console.log("\nTodas las pruebas de caminoMasCorto ejecutadas.");
