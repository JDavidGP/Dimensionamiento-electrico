import { lineasDisponiblesDeTablero, lineasRequeridas, siguienteSeleccionLineas } from "../src/shared/utils/lineasFases.ts";

let fallos = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FALLÓ:", msg); fallos++; }
  else console.log("OK:", msg);
}

assert(JSON.stringify(lineasDisponiblesDeTablero("tri")) === JSON.stringify(["L1","L2","L3"]), "tri -> 3 líneas");
assert(JSON.stringify(lineasDisponiblesDeTablero("bi")) === JSON.stringify(["L1","L2"]), "bi -> 2 líneas");
assert(JSON.stringify(lineasDisponiblesDeTablero("mono")) === JSON.stringify(["L1"]), "mono -> 1 línea");
assert(JSON.stringify(lineasDisponiblesDeTablero("otro")) === JSON.stringify([]), "desconocido -> 0 líneas, no inventa");

assert(lineasRequeridas("tri", ["L1","L2","L3"]) === 3, "tri requiere las 3 disponibles");
assert(lineasRequeridas("tri", ["L1","L2"]) === 2, "tri colgado de un bi usa las 2 que hay, no 3");
assert(lineasRequeridas("bi", ["L1","L2","L3"]) === 2, "bi requiere 2 de 3 disponibles");
assert(lineasRequeridas("mono", ["L1","L2","L3"]) === 1, "mono requiere 1");

// mono: comportamiento de radio
let sel = [];
sel = siguienteSeleccionLineas(sel, "L1", 1);
assert(JSON.stringify(sel) === JSON.stringify(["L1"]), "mono: primer click selecciona L1");
sel = siguienteSeleccionLineas(sel, "L2", 1);
assert(JSON.stringify(sel) === JSON.stringify(["L2"]), "mono: click en L2 reemplaza la selección (radio)");
sel = siguienteSeleccionLineas(sel, "L2", 1);
assert(JSON.stringify(sel) === JSON.stringify([]), "mono: click de nuevo en L2 la deselecciona");

// bi: cap en 2, no permite un tercero en silencio
sel = [];
sel = siguienteSeleccionLineas(sel, "L1", 2);
sel = siguienteSeleccionLineas(sel, "L2", 2);
assert(JSON.stringify(sel) === JSON.stringify(["L1","L2"]), "bi: dos clicks selecciona L1 y L2");
const selAntes = sel;
sel = siguienteSeleccionLineas(sel, "L3", 2);
assert(sel === selAntes, "bi: click en una tercera línea no hace nada (ya está al máximo)");
sel = siguienteSeleccionLineas(sel, "L1", 2);
assert(JSON.stringify(sel) === JSON.stringify(["L2"]), "bi: deseleccionar L1 libera un cupo");
sel = siguienteSeleccionLineas(sel, "L3", 2);
assert(JSON.stringify(sel) === JSON.stringify(["L2","L3"]), "bi: ahora sí puede agregar L3 tras liberar cupo");

console.log(fallos === 0 ? "\nTODOS LOS CHECKS PASARON" : `\n${fallos} CHECK(S) FALLARON`);
process.exit(fallos === 0 ? 0 : 1);
