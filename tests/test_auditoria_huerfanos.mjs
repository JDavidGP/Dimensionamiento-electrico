// Auditoría de datos huérfanos — usuario, 2026-11-26, "verificá que no
// hay datos huérfanos, código duplicado o inconsistencias". Bug real
// encontrado: eliminarCircuito/eliminarTablero (useCircuitos.js) ya
// liberaban marcadores del plano vinculados, pero NUNCA las rutas de
// conductor (RutaConductorPlano.entidadId) — quedaban apuntando a un id
// muerto para siempre, sin que nadie lo detectara. Prueba a nivel
// ApplicationMediator: la función de liberación en sí
// (liberarRutasDeEntidad) y la red de seguridad en
// validarIntegridadReferencial para proyectos que ya tenían el dato roto.
import { ApplicationMediator as App } from "../src/core/ApplicationMediator.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

const nodos = [
  { id: "n1", punto: { x: 0, y: 0 } },
  { id: "n2", punto: { x: 3, y: 4 } },
];

// --- 1. liberarRutasDeEntidad: desvincula entidadId Y entidadTipo, sin mutar la original ---
const rutaBase = App.plano.crearRutaConductor(["n1", "n2"], nodos, "Ruta al circuito");
const rutaVinculada = App.plano.vincularRutaConductor(rutaBase, "c1", "circuito");
const otraRuta = App.plano.vincularRutaConductor(App.plano.crearRutaConductor(["n1", "n2"], nodos, "Otra"), "c2", "circuito");

const liberadas = App.plano.liberarRutasDeEntidad("c1", [rutaVinculada, otraRuta]);
const rutaLiberada = liberadas.find((r) => r.id === rutaVinculada.id);
const rutaIntacta = liberadas.find((r) => r.id === otraRuta.id);
assert(rutaLiberada.entidadId === null && rutaLiberada.entidadTipo === null, "liberarRutasDeEntidad desvincula entidadId Y entidadTipo de la ruta afectada");
assert(rutaIntacta.entidadId === "c2", "liberarRutasDeEntidad NO toca rutas vinculadas a OTRA entidad");
assert(rutaVinculada.entidadId === "c1", "liberarRutasDeEntidad no muta la ruta original (devuelve copias)");

const sinCambios = App.plano.liberarRutasDeEntidad("id-que-nadie-tiene", [rutaVinculada]);
assert(sinCambios[0].entidadId === "c1", "liberarRutasDeEntidad con un id que ninguna ruta tiene -> no cambia nada");

// --- 2. Red de seguridad en validarIntegridadReferencial: detecta una
//     ruta que YA quedó huérfana (ej. de un proyecto guardado antes de
//     este fix) y lo marca como ERROR, no advertencia — mismo criterio
//     que "Referencia a tablero inexistente" en el circuito. ---
const proyecto = { id: "p1", nombre: "Proyecto test" };
const circuito1 = { id: "c1", nombre: "Tomas cocina", distancia: 5 };

// entidadId "c1" SÍ existe como circuito -> sin problema.
let lista = App.validacion.listaIntegridad(proyecto, [circuito1], [], [], [], [], [], [], [], [rutaVinculada]);
assert(!lista.some((e) => e.tipo === "rutaConductor"), "Ruta vinculada a un circuito que SÍ existe -> ninguna entrada de ruta huérfana");

// Mismo entidadId "c1", pero SIN pasar el circuito -> huérfana, se reporta.
lista = App.validacion.listaIntegridad(proyecto, [], [], [], [], [], [], [], [], [rutaVinculada]);
const entradaHuerfana = lista.find((e) => e.tipo === "rutaConductor");
assert(!!entradaHuerfana, "Ruta vinculada a un circuito que YA NO EXISTE -> aparece como entrada propia 'rutaConductor'");
assert(entradaHuerfana?.estado === "error", `Es ERROR, no advertencia — es un dato roto (real: ${entradaHuerfana?.estado})`);
assert(entradaHuerfana?.problemas.some((p) => p.includes("c1")), "El problema menciona el id muerto exacto");

// Ruta sin vínculo (entidadId null) -> nunca genera una entrada, nada que reportar.
lista = App.validacion.listaIntegridad(proyecto, [], [], [], [], [], [], [], [], [rutaBase]);
assert(!lista.some((e) => e.tipo === "rutaConductor"), "Ruta sin vínculo (entidadId null) -> ninguna entrada, no es un problema");

// Ruta vinculada a un TABLERO que sí existe -> ok; mismo id, pero como circuito, no existe -> huérfana (respeta entidadTipo).
const tablero1 = App.tablero.crear({ nombre: "TD-sub1" });
const rutaATablero = App.plano.vincularRutaConductor(App.plano.crearRutaConductor(["n1", "n2"], nodos), tablero1.id, "tablero");
lista = App.validacion.listaIntegridad(proyecto, [], [], [tablero1], [], [], [], [], [], [rutaATablero]);
assert(!lista.some((e) => e.tipo === "rutaConductor"), "Ruta vinculada a un TABLERO que sí existe -> sin problema");
lista = App.validacion.listaIntegridad(proyecto, [], [], [], [], [], [], [], [], [rutaATablero]);
assert(lista.some((e) => e.tipo === "rutaConductor" && e.problemas.some((p) => p.includes("tablero"))), "Mismo vínculo sin pasar los tableros -> huérfana, el mensaje dice 'tablero' (respeta entidadTipo, no busca en circuitos)");

// --- 3. resumen() también cuenta la ruta huérfana como error ---
const resumenConHuerfana = App.validacion.resumen(proyecto, [], [], [], [], [], [], [], [], [rutaVinculada]);
assert(resumenConHuerfana.error >= 1, "resumen() cuenta el error de la ruta huérfana");

console.log("\nTodas las pruebas completadas.");
