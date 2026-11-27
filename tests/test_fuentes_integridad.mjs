import { ApplicationMediator as App } from "../src/core/ApplicationMediator.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

const proyecto = { id: "p1", nombre: "Proyecto test" };
// `rol` ya no existe en FuenteEnergia (rediseño: los 3 roles -Principal/
// Secundaria/Auxiliar- se eligen juntos en el propio tablero, no quedan
// fijos en la fuente) — ver modules/origen/fuentesEnergia.js, normalizar().
const generador = App.origen.crearFuente({ nombre: "Generador diesel", tipo: "generador" });

// --- 1. Sin nodo vinculado: aparece como entrada propia con advertencia ---
let lista = App.validacion.listaIntegridad(proyecto, [], [], [], [generador], []);
const entradaFuente = lista.find((e) => e.tipo === "fuenteEnergia" && e.id === generador.id);
assert(!!entradaFuente, "La fuente de energía aparece como su propia entrada en listaIntegridad");
assert(entradaFuente.problemas.includes("Sin representar en el diagrama unifilar"), "Advertencia de representación presente");
assert(entradaFuente.estado === "advertencia", "Estado advertencia, no error");
assert(entradaFuente.resumen === "generador", `El resumen es el tipo de la fuente (real: '${entradaFuente.resumen}')`);

// --- 2. Vinculada a un nodo: la advertencia desaparece ---
const nodo = App.diagrama.crearNodo({ tipo: "generador", nombre: "G1", posicion: { x: 0, y: 0 }, entidadId: generador.id });
lista = App.validacion.listaIntegridad(proyecto, [], [], [], [generador], [nodo]);
const entradaFuente2 = lista.find((e) => e.tipo === "fuenteEnergia" && e.id === generador.id);
assert(!entradaFuente2.problemas.includes("Sin representar en el diagrama unifilar"), "Tras vincular, la advertencia desaparece");
assert(entradaFuente2.estado === "ok", "Estado vuelve a ok");

// --- 3. resumen() también cuenta la fuente ---
const resumenSinNodo = App.validacion.resumen(proyecto, [], [], [], [generador], []);
assert(resumenSinNodo.advertencia >= 1, "resumen() cuenta la advertencia de la fuente sin representar");

console.log("\nTodas las pruebas completadas.");
