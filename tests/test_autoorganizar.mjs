// Autoorganización del diagrama unifilar (usuario, 2026-11-20) — layout
// en capas por camino más largo desde un nodo raíz, sentido de las
// conexiones.
import { ApplicationMediator as App } from "../src/core/ApplicationMediator.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

// --- 1. Cadena lineal A -> B -> C: niveles 0,1,2 (y creciente) ---
const nodosLineal = [{ id: "A" }, { id: "B" }, { id: "C" }];
const conexionesLineal = [
  { nodoOrigenId: "A", nodoDestinoId: "B" },
  { nodoOrigenId: "B", nodoDestinoId: "C" },
];
const posLineal = App.diagrama.autoorganizar(nodosLineal, conexionesLineal);
assert(posLineal.A.y < posLineal.B.y && posLineal.B.y < posLineal.C.y, "Cadena lineal: cada nodo queda más abajo que su origen");
assert(posLineal.A.x === posLineal.B.x && posLineal.B.x === posLineal.C.x, "Cadena lineal: un solo nodo por nivel, misma columna");

// --- 2. Ramificación: A -> B, A -> C (B y C mismo nivel, distinta columna) ---
const nodosRama = [{ id: "A" }, { id: "B" }, { id: "C" }];
const conexionesRama = [
  { nodoOrigenId: "A", nodoDestinoId: "B" },
  { nodoOrigenId: "A", nodoDestinoId: "C" },
];
const posRama = App.diagrama.autoorganizar(nodosRama, conexionesRama);
assert(posRama.B.y === posRama.C.y, "Ramificación: los dos hijos quedan en el mismo nivel (misma fila)");
assert(posRama.B.x !== posRama.C.x, "Ramificación: los dos hijos quedan en columnas distintas (no se superponen)");
assert(posRama.A.y < posRama.B.y, "Ramificación: el padre queda arriba de ambos hijos");

// --- 3. Fusión: A -> C, B -> C (A y B nivel 0, C queda DEBAJO de ambos) ---
const nodosFusion = [{ id: "A" }, { id: "B" }, { id: "C" }];
const conexionesFusion = [
  { nodoOrigenId: "A", nodoDestinoId: "C" },
  { nodoOrigenId: "B", nodoDestinoId: "C" },
];
const posFusion = App.diagrama.autoorganizar(nodosFusion, conexionesFusion);
assert(posFusion.A.y === posFusion.B.y, "Fusión: los dos padres quedan en el mismo nivel");
assert(posFusion.C.y > posFusion.A.y && posFusion.C.y > posFusion.B.y, "Fusión: el hijo común queda debajo de AMBOS padres");

// --- 4. Fusión con profundidades distintas: C depende de A (directo) y de B (vía D) — C debe quedar debajo del más profundo (D) ---
const nodosAsim = [{ id: "A" }, { id: "B" }, { id: "D" }, { id: "C" }];
const conexionesAsim = [
  { nodoOrigenId: "A", nodoDestinoId: "C" }, // A (nivel 0) -> C directo
  { nodoOrigenId: "B", nodoDestinoId: "D" }, // B (nivel 0) -> D (nivel 1)
  { nodoOrigenId: "D", nodoDestinoId: "C" }, // D (nivel 1) -> C
];
const posAsim = App.diagrama.autoorganizar(nodosAsim, conexionesAsim);
assert(posAsim.C.y > posAsim.D.y, "Profundidad asimétrica: C queda debajo del camino MÁS largo hasta él (vía D), no del más corto (vía A)");

// --- 5. Nodo aislado (sin conexiones): nivel 0, no explota ---
const posAislado = App.diagrama.autoorganizar([{ id: "X" }], []);
assert(posAislado.X.y === 20, "Nodo aislado sin conexiones: nivel 0 (margenY por defecto)");

// --- 6. Sin nodos: no explota, devuelve objeto vacío ---
const posVacio = App.diagrama.autoorganizar([], []);
assert(Object.keys(posVacio).length === 0, "Sin nodos: devuelve un objeto vacío, no explota");

// --- 7. Conexión con referencia rota (nodo inexistente): se ignora, no explota ---
const posRota = App.diagrama.autoorganizar([{ id: "A" }], [{ nodoOrigenId: "A", nodoDestinoId: "NO-EXISTE" }]);
assert(posRota.A.y === 20, "Conexión con referencia rota: se ignora (A queda en nivel 0, no se inventa un nivel por una referencia inválida)");

// --- 8. Ciclo (A -> B -> A): no entra en loop infinito, ambos caen a nivel 0 por defecto ---
const inicio = Date.now();
const posCiclo = App.diagrama.autoorganizar(
  [{ id: "A" }, { id: "B" }],
  [
    { nodoOrigenId: "A", nodoDestinoId: "B" },
    { nodoOrigenId: "B", nodoDestinoId: "A" },
  ]
);
const tardo = Date.now() - inicio;
assert(tardo < 1000, `Un ciclo no traba el cálculo (tardó ${tardo}ms)`);
assert(posCiclo.A.y === 20 && posCiclo.B.y === 20, "Un ciclo: ningún nodo libera sus entradas pendientes, ambos quedan en nivel 0 por defecto (no se inventa nada)");

console.log("\nTodas las pruebas completadas.");
