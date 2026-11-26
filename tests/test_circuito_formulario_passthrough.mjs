// Bug real encontrado y corregido al agregar AFCI (2026-11-26):
// formularioACircuito/circuitoAFormulario no tenían pass-through para
// `diferencialId` (campo sin UI propia en el formulario, se asigna vía
// DiferencialMediator) — CUALQUIER edición de un circuito ya asignado
// a un diferencial (ej. solo cambiar el nombre) lo perdía en silencio,
// mismo patrón ya resuelto para `tableroId`. Prueba la capa PURA:
// formularioACircuito/circuitoAFormulario (modules/validacion/formularios.ts).
import { formularioACircuito, circuitoAFormulario } from "../src/modules/validacion/index.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

const formBase = {
  nombre: "Circuito prueba",
  fases: "mono",
  voltaje: "120",
  material: "cobre",
  distancia: "10",
  temp: "30",
};

// --- 1. Un circuito YA asignado a un tablero y un diferencial, editado por su formulario (ej. renombrarlo) NO pierde ninguno de los 2 ---
const circuitoOriginal = formularioACircuito(formBase, "c1");
const circuitoConTableroYDiferencial = { ...circuitoOriginal, tableroId: "t1", diferencialId: "d1", proteccionAFCI: true };

const formDeEdicion = circuitoAFormulario(circuitoConTableroYDiferencial);
assert(formDeEdicion.tableroId === "t1", "circuitoAFormulario conserva tableroId en el formulario de edición");
assert(formDeEdicion.diferencialId === "d1", "circuitoAFormulario conserva diferencialId en el formulario de edición (el bug: antes no existía este campo)");
assert(formDeEdicion.proteccionAFCI === true, "circuitoAFormulario conserva proteccionAFCI en el formulario de edición");

const circuitoReguardado = formularioACircuito({ ...formDeEdicion, nombre: "Circuito renombrado" }, "c1");
assert(circuitoReguardado.tableroId === "t1", "Tras renombrar y re-guardar, tableroId sigue intacto");
assert(circuitoReguardado.diferencialId === "d1", "Tras renombrar y re-guardar, diferencialId sigue intacto — ya NO se pierde en silencio");
assert(circuitoReguardado.proteccionAFCI === true, "Tras renombrar y re-guardar, proteccionAFCI sigue intacto");

// --- 2. Un circuito NUEVO (sin tablero/diferencial todavía) no inventa ninguno de los 2 ---
const circuitoNuevo = formularioACircuito(formBase, null);
assert(circuitoNuevo.tableroId === null, "Circuito nuevo: tableroId null, no se inventa uno");
assert(circuitoNuevo.diferencialId === null, "Circuito nuevo: diferencialId null, no se inventa uno");
assert(circuitoNuevo.proteccionAFCI === false, "Circuito nuevo: proteccionAFCI false por defecto");

console.log("\nTodas las pruebas completadas.");
