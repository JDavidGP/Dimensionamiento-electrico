// Caja de empalme como punto real de la topología de ruteo — usuario,
// 2026-11-26, retomando el punto dejado pendiente a propósito el
// 2026-11-24 ("la opción 1 me sirve por el momento"): "que la caja de
// empalme sepa qué circuito(s) pasan por ella". Prueba la capa PURA:
// PlanoMediator.entidadesPorCajaEmpalme (modules/plano/index.ts +
// PlanoMediator.js, nodoCercano/rutas ya existentes, nada nuevo ahí).
import { ApplicationMediator as App } from "../src/core/ApplicationMediator.js";

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

function nodo(id, x, y) {
  return { id, punto: { x, y } };
}
function marcadorCaja(id, x, y, nombre = "") {
  return { id, punto: { x, y }, tipo: "caja_empalme", entidadId: null, nombre, controlaMarcadorId: null };
}
function ruta(id, nodoIds, entidadId = null, entidadTipo = null) {
  return { id, nodoIds, nombre: "Ruta sin nombre", longitudM: 0, entidadId, entidadTipo };
}

const nodos = [nodo("A", 0, 0), nodo("B", 3, 0), nodo("C", 6, 0)];
const circuitos = [{ id: "circ1", nombre: "Iluminación cocina" }];
const tableros = [{ id: "tab1", nombre: "Tablero principal" }];

// --- 1. Caja sin ningún nodo cerca -> sin entidades, no revienta ---
const r1 = App.plano.entidadesPorCajaEmpalme({
  marcadores: [marcadorCaja("caja_lejos", 100, 100)],
  nodos,
  rutas: [],
  circuitos,
  tableros,
});
assert(Array.isArray(r1["caja_lejos"]) && r1["caja_lejos"].length === 0, "Caja lejos de cualquier nodo: lista vacía, no revienta");

// --- 2. Ruta pasa por el nodo de la caja, pero SIN vincular -> no cuenta ---
const r2 = App.plano.entidadesPorCajaEmpalme({
  marcadores: [marcadorCaja("caja1", 3, 0)],
  nodos,
  rutas: [ruta("r1", ["A", "B", "C"])], // sin entidadId
  circuitos,
  tableros,
});
assert(r2["caja1"].length === 0, "Ruta sin vincular (ni confirmada por el usuario) no cuenta como 'pasa por acá'");

// --- 3. Ruta vinculada a un CIRCUITO, pasa por el nodo de la caja -> SÍ cuenta ---
const r3 = App.plano.entidadesPorCajaEmpalme({
  marcadores: [marcadorCaja("caja1", 3, 0)],
  nodos,
  rutas: [ruta("r1", ["A", "B", "C"], "circ1", "circuito")],
  circuitos,
  tableros,
});
assert(r3["caja1"].length === 1, `El circuito vinculado SÍ aparece (real: ${r3["caja1"].length})`);
assert(r3["caja1"][0]?.nombre === "Iluminación cocina" && r3["caja1"][0]?.tipo === "circuito", "Trae el nombre y tipo correctos");

// --- 4. Un circuito Y un tablero, cada uno con su propia ruta vinculada, ambos pasan por la misma caja -> ambos aparecen ---
const r4 = App.plano.entidadesPorCajaEmpalme({
  marcadores: [marcadorCaja("caja1", 3, 0)],
  nodos,
  rutas: [ruta("r1", ["A", "B"], "circ1", "circuito"), ruta("r2", ["B", "C"], "tab1", "tablero")],
  circuitos,
  tableros,
});
assert(r4["caja1"].length === 2, `Circuito Y tablero, cada uno con su propia ruta que toca el nodo B: ambos aparecen (real: ${r4["caja1"].length})`);

// --- 5. La MISMA entidad con 2 rutas que pasan por la caja no se duplica ---
const r5 = App.plano.entidadesPorCajaEmpalme({
  marcadores: [marcadorCaja("caja1", 3, 0)],
  nodos,
  rutas: [ruta("r1", ["A", "B"], "circ1", "circuito"), ruta("r2", ["B", "C"], "circ1", "circuito")],
  circuitos,
  tableros,
});
assert(r5["caja1"].length === 1, `El mismo circuito con 2 rutas que tocan la caja no se duplica (real: ${r5["caja1"].length})`);

// --- 6. Ruta vinculada a un id de entidad que ya NO existe -> no revienta, no la cuenta ---
const r6 = App.plano.entidadesPorCajaEmpalme({
  marcadores: [marcadorCaja("caja1", 3, 0)],
  nodos,
  rutas: [ruta("r1", ["A", "B", "C"], "circ-muerto", "circuito")],
  circuitos,
  tableros,
});
assert(r6["caja1"].length === 0, "Un circuito vinculado que ya no existe no revienta ni aparece en la lista");

console.log("\nTodas las pruebas completadas.");
