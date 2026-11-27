// Instalación de interiores y exteriores en el Plano — usuario,
// 2026-11-25: "por medio de ambiente... así separar lo interior del
// hogar de lo exterior, como puede ser un cobertizo, luces de
// exteriores, alguna bomba que se encuentre afuera en un cuarto
// aparte". Cada ambiente se marca exterior=true/false (default
// false); un equipo colocado adentro HEREDA la condición al leerla
// (habitacionQueContiene), nunca se copia aparte. Prueba pura, sin
// navegador (geometría de modules/plano/index.ts) — la verificación
// en vivo contra la UI real va en test_interior_exterior_plano_ui.mjs.
import { ApplicationMediator as App } from "../src/core/ApplicationMediator.ts";

let fallos = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FALLÓ:", msg); fallos++; }
  else console.log("OK:", msg);
}

const nodos = [
  { id: "a", punto: { x: 0, y: 0 } },
  { id: "b", punto: { x: 4, y: 0 } },
  { id: "c", punto: { x: 4, y: 3 } },
  { id: "d", punto: { x: 0, y: 3 } },
  { id: "e", punto: { x: 10, y: 10 } },
  { id: "f", punto: { x: 14, y: 10 } },
  { id: "g", punto: { x: 14, y: 13 } },
  { id: "h", punto: { x: 10, y: 13 } },
];

const sala = { id: "sala", nodoIds: ["a", "b", "c", "d"], nombre: "Sala", areaM2: 12, perimetroM: 14, alturaM: null, exterior: false };
const cobertizo = { id: "cobertizo", nodoIds: ["e", "f", "g", "h"], nombre: "Cobertizo", areaM2: 12, perimetroM: 14, alturaM: null, exterior: true };
const habitaciones = [sala, cobertizo];

// --- crearHabitacion: exterior=false por defecto ---
const nueva = App.plano.crearHabitacion(["a", "b", "c", "d"], nodos, "Prueba");
assert(nueva.exterior === false, "Un ambiente recién creado es interior por defecto (exterior=false)");

// --- habitacionQueContiene ---
assert(App.plano.habitacionQueContiene({ x: 2, y: 1.5 }, habitaciones, nodos)?.id === "sala", "Un punto dentro de 'Sala' encuentra esa habitación");
assert(App.plano.habitacionQueContiene({ x: 12, y: 11.5 }, habitaciones, nodos)?.id === "cobertizo", "Un punto dentro de 'Cobertizo' encuentra esa habitación");
assert(App.plano.habitacionQueContiene({ x: 50, y: 50 }, habitaciones, nodos) === null, "Un punto fuera de TODOS los ambientes: null (no inventa un ambiente)");
assert(App.plano.habitacionQueContiene({ x: 2, y: 1.5 }, [], nodos) === null, "Sin ninguna habitación, null");

// --- El equipo hereda exterior/interior del ambiente que lo contiene (no se copia, se deriva) ---
const equipoEnSala = { id: "eq1", punto: { x: 2, y: 1.5 }, tipo: "tomacorriente", entidadId: null, nombre: "" };
const equipoEnCobertizo = { id: "eq2", punto: { x: 12, y: 11.5 }, tipo: "luminaria", entidadId: null, nombre: "" };
const equipoSinAmbiente = { id: "eq3", punto: { x: 50, y: 50 }, tipo: "tomacorriente", entidadId: null, nombre: "" };

assert(App.plano.habitacionQueContiene(equipoEnSala.punto, habitaciones, nodos)?.exterior === false, "Equipo dentro de 'Sala' (interior): hereda exterior=false");
assert(App.plano.habitacionQueContiene(equipoEnCobertizo.punto, habitaciones, nodos)?.exterior === true, "Equipo dentro de 'Cobertizo' (exterior): hereda exterior=true");
assert(App.plano.habitacionQueContiene(equipoSinAmbiente.punto, habitaciones, nodos) === null, "Equipo fuera de todo ambiente: sin ambiente asignado (ni interior ni exterior)");

// --- Si se mueve el equipo (o se marca/desmarca el ambiente), el equipo sigue el cambio solo ---
const salaAhoraExterior = { ...sala, exterior: true };
const habitacionesTrasMarcar = [salaAhoraExterior, cobertizo];
assert(App.plano.habitacionQueContiene(equipoEnSala.punto, habitacionesTrasMarcar, nodos)?.exterior === true, "Al marcar 'Sala' como exterior, el mismo equipo (sin tocarlo) ahora lee exterior=true");

console.log(fallos === 0 ? "\nTODOS LOS CHECKS PASARON" : `\n${fallos} CHECK(S) FALLARON`);
process.exit(fallos === 0 ? 0 : 1);
