// colorAmbiente (sombreado por ambiente, styles/colores.ts) — prueba
// PURA del hash. Nace al encontrar que test_sombreado_ambiente_ui.mjs
// tenía una falla estadística: generaba 2 habitaciones con id aleatorio
// (generarId()) y afirmaba que sus colores eran SIEMPRE distintos — con
// solo 8 slots fijos, 2 ids al azar tienen ~12,5% de chance de colisionar
// (comportamiento ESPERADO, no un bug: la paleta es categórica de 8
// colores, nunca se inventa un 9no). Esta prueba fija 2 ids LITERALES
// cuyo slot ya se calculó de antemano (ver abajo) para verificar, sin
// depender del azar, que el hash SÍ distingue ids distintos cuando caen
// en slots distintos — la prueba de UI sigue cubriendo todo lo demás
// (formato, estabilidad, pointer-events) sin esa aserción frágil.
import { colorAmbiente, PALETA_AMBIENTES } from "../src/styles/colores.ts";

let fallos = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FALLÓ:", msg); fallos++; }
  else console.log("OK:", msg);
}

// Calculados a mano con el mismo algoritmo (hash*31 + charCode, mod 8):
// "habitacion-a" -> slot 6, "habitacion-b" -> slot 7.
assert(colorAmbiente("habitacion-a") === "var(--ambiente-7)", `"habitacion-a" cae en el slot 6 (real: ${colorAmbiente("habitacion-a")})`);
assert(colorAmbiente("habitacion-b") === "var(--ambiente-8)", `"habitacion-b" cae en el slot 7 (real: ${colorAmbiente("habitacion-b")})`);
assert(colorAmbiente("habitacion-a") !== colorAmbiente("habitacion-b"), "2 ids elegidos a propósito en slots distintos dan colores DISTINTOS");

assert(colorAmbiente("sala-1") === colorAmbiente("sala-1"), "mismo id siempre da el mismo color (estable, no aleatorio por llamada)");

assert(PALETA_AMBIENTES.every((c) => /^var\(--ambiente-\d\)$/.test(c)), "los 8 slots son referencias CSS var, no hex sueltos");
assert(PALETA_AMBIENTES.length === 8, `la paleta tiene exactamente 8 slots fijos (real: ${PALETA_AMBIENTES.length})`);

for (const id of ["a", "bb", "ccc", "dddd", "sala-1", "comedor-1", "cocina-xyz"]) {
  assert(PALETA_AMBIENTES.includes(colorAmbiente(id)), `cualquier id (ej. "${id}") cae en uno de los 8 slots fijos, nunca fuera de la paleta`);
}

console.log(fallos === 0 ? "\nTODOS LOS CHECKS PASARON" : `\n${fallos} CHECK(S) FALLARON`);
process.exit(fallos === 0 ? 0 : 1);
