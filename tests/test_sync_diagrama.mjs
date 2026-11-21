import { ApplicationMediator as App } from "../src/core/ApplicationMediator.js";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

// --- Datos de prueba: un tablero, dos equipos, una fuente de energía ---
const tablero = App.tablero.crear({ nombre: "TD-1" });
const circuito = { id: "circ1", nombre: "Iluminación sala", tableroId: tablero.id };
const equipo1 = { id: "eq1", nombre: "Luminaria sala", circuitoId: "circ1" };
const equipo2 = { id: "eq2", nombre: "Tomacorriente cocina", circuitoId: "circ1" };
const generador = App.origen.crearFuente({ nombre: "Generador diesel", tipo: "generador" });
const bateria = App.origen.crearFuente({ nombre: "Banco solar", tipo: "bateria" });

const circuitos = [circuito];
const equipos = [equipo1, equipo2];
const tableros = [tablero];
const fuentesEnergia = [generador, bateria];

// --- candidatosEntidad: filtra por tipo correcto ---
const candTablero = App.diagrama.candidatosEntidad("tablero_electrico", { tableros, equipos, fuentesEnergia, nodos: [] });
assert(candTablero.length === 1 && candTablero[0].id === tablero.id, "candidatosEntidad(tablero_electrico) devuelve el tablero");

const candEquipo = App.diagrama.candidatosEntidad("luminaria", { tableros, equipos, fuentesEnergia, nodos: [] });
assert(candEquipo.length === 2, "candidatosEntidad(luminaria) devuelve ambos equipos (no filtra por sub-tipo de equipo)");

const candGenerador = App.diagrama.candidatosEntidad("generador", { tableros, equipos, fuentesEnergia, nodos: [] });
assert(candGenerador.length === 1 && candGenerador[0].id === generador.id, "candidatosEntidad(generador) solo devuelve fuentes tipo generador");

const candBateria = App.diagrama.candidatosEntidad("banco_baterias", { tableros, equipos, fuentesEnergia, nodos: [] });
assert(candBateria.length === 1 && candBateria[0].id === bateria.id, "candidatosEntidad(banco_baterias) solo devuelve fuentes tipo bateria");

const candSinEntidad = App.diagrama.candidatosEntidad("medidor", { tableros, equipos, fuentesEnergia, nodos: [] });
assert(candSinEntidad.length === 0, "candidatosEntidad(medidor) vacío — sin entidadVinculada");

// --- crear nodos vinculados y comprobar exclusión 1-a-1 ---
let nodos = [];
const nodoTablero = App.diagrama.crearNodo({ tipo: "tablero_electrico", nombre: "TD-1", posicion: { x: 0, y: 0 }, entidadId: tablero.id });
nodos.push(nodoTablero);

const nodoLum = App.diagrama.crearNodo({ tipo: "luminaria", nombre: "L1", posicion: { x: 0, y: 0 }, entidadId: equipo1.id });
nodos.push(nodoLum);

const candEquipoTrasVincular = App.diagrama.candidatosEntidad("luminaria", { tableros, equipos, fuentesEnergia, nodos });
assert(
  candEquipoTrasVincular.length === 1 && candEquipoTrasVincular[0].id === equipo2.id,
  "equipo1 ya vinculado queda excluido de los candidatos (relación 1 a 1)"
);

// pero al reeditar el MISMO nodo, su propia entidad vuelve a aparecer (nodoId excluido de la exclusión)
const candReedicion = App.diagrama.candidatosEntidad("luminaria", { tableros, equipos, fuentesEnergia, nodos, nodoId: nodoLum.id });
assert(
  candReedicion.length === 2,
  "al reeditar el propio nodo, su entidad actual sigue apareciendo entre los candidatos"
);

// --- resolverEntidad: nombre vivo ---
const entidadResuelta = App.diagrama.resolverEntidad(nodoTablero, { tableros, equipos, fuentesEnergia });
assert(entidadResuelta?.nombre === "TD-1", "resolverEntidad devuelve el tablero vinculado");

const nodoSinVinculo = App.diagrama.crearNodo({ tipo: "medidor", nombre: "M1", posicion: { x: 0, y: 0 } });
assert(App.diagrama.resolverEntidad(nodoSinVinculo, { tableros, equipos, fuentesEnergia }) === null, "resolverEntidad null si no hay entidadId");

const nodoHuerfano = App.diagrama.crearNodo({ tipo: "tablero_electrico", nombre: "Fantasma", posicion: { x: 0, y: 0 }, entidadId: "id-que-no-existe" });
assert(App.diagrama.resolverEntidad(nodoHuerfano, { tableros, equipos, fuentesEnergia }) === null, "resolverEntidad null si la entidad referenciada no existe (defensivo)");

// --- liberarNodosDeEntidad: simula borrar el tablero ---
const nodosTrasBorrarTablero = App.diagrama.liberarNodosDeEntidad(tablero.id, nodos);
const nodoTableroTrasBorrar = nodosTrasBorrarTablero.find((n) => n.id === nodoTablero.id);
assert(nodoTableroTrasBorrar.entidadId === null, "liberarNodosDeEntidad desvincula (no borra) el nodo cuando su entidad se elimina");
assert(nodosTrasBorrarTablero.length === nodos.length, "liberarNodosDeEntidad no borra el nodo, solo quita el vínculo");
const nodoLumIntacto = nodosTrasBorrarTablero.find((n) => n.id === nodoLum.id);
assert(nodoLumIntacto.entidadId === equipo1.id, "liberarNodosDeEntidad no toca nodos vinculados a OTRA entidad");

console.log("\nTodas las pruebas completadas.");
