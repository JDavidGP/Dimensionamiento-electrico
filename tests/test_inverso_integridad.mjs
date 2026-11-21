import { ApplicationMediator as App } from "../src/core/ApplicationMediator.js";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

const proyecto = { id: "p1", nombre: "Proyecto test" };
const tablero = App.tablero.crear({ nombre: "TD-1" });
const circuito = App.validacion.formularioACircuito(
  { ...App.data.tablas.plantillas().CIRCUITO_VACIO, nombre: "Iluminación", tableroId: tablero.id, voltaje: "120", fases: "mono" },
  null
);
const equipo = App.validacion.formularioAEquipo(
  { ...App.data.tablas.plantillas().EQUIPO_VACIO, nombre: "Luminaria 1", valor: "100" },
  circuito.id,
  null
);

const circuitos = [circuito];
const equipos = [equipo];
const tableros = [tablero];
const fuentesEnergia = [];

// --- 1. Sin NINGÚN nodo de diagrama: tablero y circuito deben advertir "sin representar" ---
let lista = App.validacion.listaIntegridad(proyecto, circuitos, equipos, tableros, fuentesEnergia, []);
const entradaTablero = lista.find((e) => e.tipo === "tablero" && e.id === tablero.id);
const entradaCircuito = lista.find((e) => e.tipo === "circuito" && e.id === circuito.id);

assert(
  entradaTablero.problemas.includes("Sin representar en el diagrama unifilar"),
  "Tablero sin nodo vinculado -> advertencia en listaIntegridad"
);
assert(entradaTablero.estado === "advertencia", "Estado del tablero pasa a advertencia (no error) por falta de representación");
assert(
  entradaCircuito.problemas.some((p) => p.includes("Luminaria 1") && p.includes("sin representar en el diagrama unifilar")),
  "Circuito reporta el nombre del equipo sin representar"
);

// --- 2. Con un nodo que vincula el TABLERO: su advertencia desaparece, la del equipo persiste ---
const nodoTablero = App.diagrama.crearNodo({ tipo: "tablero_electrico", nombre: "TD-1", posicion: { x: 0, y: 0 }, entidadId: tablero.id });
lista = App.validacion.listaIntegridad(proyecto, circuitos, equipos, tableros, fuentesEnergia, [nodoTablero]);
const entradaTablero2 = lista.find((e) => e.tipo === "tablero" && e.id === tablero.id);
const entradaCircuito2 = lista.find((e) => e.tipo === "circuito" && e.id === circuito.id);
assert(
  !entradaTablero2.problemas.includes("Sin representar en el diagrama unifilar"),
  "Tras vincular el tablero a un nodo, la advertencia desaparece"
);
assert(
  entradaCircuito2.problemas.some((p) => p.includes("sin representar en el diagrama unifilar")),
  "El equipo todavía no tiene nodo -> el circuito sigue advirtiendo"
);

// --- 3. Vinculando también el equipo: ninguna advertencia de representación queda ---
const nodoEquipo = App.diagrama.crearNodo({ tipo: "luminaria", nombre: "L1", posicion: { x: 0, y: 0 }, entidadId: equipo.id });
lista = App.validacion.listaIntegridad(proyecto, circuitos, equipos, tableros, fuentesEnergia, [nodoTablero, nodoEquipo]);
const entradaCircuito3 = lista.find((e) => e.tipo === "circuito" && e.id === circuito.id);
assert(
  !entradaCircuito3.problemas.some((p) => p.includes("sin representar en el diagrama unifilar")),
  "Con tablero Y equipo vinculados, no queda ninguna advertencia de representación"
);

// --- 4. resumen() también refleja el conteo (sigue siendo "advertencia", no "error") ---
const resumenSinNodos = App.validacion.resumen(proyecto, circuitos, equipos, tableros, fuentesEnergia, []);
assert(resumenSinNodos.advertencia > 0, "resumen() cuenta las advertencias de representación");
assert(resumenSinNodos.error === 0, "No se inventan errores por falta de representación en el diagrama (es solo advertencia)");

console.log("\nTodas las pruebas completadas.");
