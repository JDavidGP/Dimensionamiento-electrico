import { puntosRectangulo, puntoDentroDePoligono, areaPoligono, perimetroPoligono } from "../src/modules/geometria/index.ts";
import { crearHabitacionRectangular, moverNodos } from "../src/modules/plano/index.ts";

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

// --- puntosRectangulo ---
const centro = { x: 10, y: 5 };
const puntos = puntosRectangulo(centro, 12, 8);
assert(puntos.length === 4, "puntosRectangulo devuelve 4 esquinas");
assert(Math.abs(areaPoligono(puntos) - 96) < 1e-9, `Área del rectángulo 12x8 = 96 m² (real: ${areaPoligono(puntos)})`);
assert(Math.abs(perimetroPoligono(puntos) - 40) < 1e-9, `Perímetro del rectángulo 12x8 = 2*(12+8)=40 m (real: ${perimetroPoligono(puntos)})`);
assert(puntoDentroDePoligono(centro, puntos), "El centro cae DENTRO de su propio rectángulo");
assert(!puntoDentroDePoligono({ x: 100, y: 100 }, puntos), "Un punto lejano NO cae dentro del rectángulo");
assert(!puntoDentroDePoligono({ x: 10, y: -100 }, puntos), "Un punto fuera del rango Y tampoco cae dentro");

// --- crearHabitacionRectangular ---
const resultado = crearHabitacionRectangular({ x: 0, y: 0 }, 12, 8, "Habitación #1");
assert(resultado.nodos.length === 4, "crearHabitacionRectangular crea 4 nodos");
assert(resultado.segmentos.length === 4, "crearHabitacionRectangular crea 4 segmentos (paredes)");
assert(resultado.segmentos.every((s) => s.tipo === "pared"), "Los 4 segmentos son de tipo 'pared'");
assert(resultado.habitacion.nombre === "Habitación #1", "La habitación toma el nombre pedido");
assert(Math.abs(resultado.habitacion.areaM2 - 96) < 1e-9, `El área de la habitación generada es exacta: 96 m² (real: ${resultado.habitacion.areaM2})`);
assert(Math.abs(resultado.habitacion.perimetroM - 40) < 1e-9, `El perímetro de la habitación generada es exacto: 40 m (real: ${resultado.habitacion.perimetroM})`);
// Los segmentos deben formar efectivamente un LAZO CERRADO sobre los 4 nodos (cada nodo aparece exactamente 2 veces entre nodoAId/nodoBId).
const conteoPorNodo = {};
for (const s of resultado.segmentos) {
  conteoPorNodo[s.nodoAId] = (conteoPorNodo[s.nodoAId] || 0) + 1;
  conteoPorNodo[s.nodoBId] = (conteoPorNodo[s.nodoBId] || 0) + 1;
}
assert(resultado.nodos.every((n) => conteoPorNodo[n.id] === 2), "Cada nodo generado participa de exactamente 2 segmentos (lazo cerrado válido)");

const nulo = crearHabitacionRectangular({ x: 0, y: 0 }, 0, 8, "inválida");
assert(nulo === null, "Un ancho de 0 (o negativo) no genera nada — ancho/alto deben ser > 0");

// --- moverNodos ---
const nodosOriginales = resultado.nodos;
const nodosMovidos = moverNodos(
  resultado.habitacion.nodoIds,
  { x: 5, y: -3 },
  nodosOriginales
);
for (let i = 0; i < nodosOriginales.length; i++) {
  const original = nodosOriginales[i];
  const movido = nodosMovidos.find((n) => n.id === original.id);
  assert(
    Math.abs(movido.punto.x - (original.punto.x + 5)) < 1e-9 && Math.abs(movido.punto.y - (original.punto.y - 3)) < 1e-9,
    `moverNodos traslada el nodo ${original.id} exactamente por el delta pedido`
  );
}
// El área/perímetro deben mantenerse idénticos tras el movimiento (es una traslación rígida, no una deformación).
const puntosMovidos = resultado.habitacion.nodoIds.map((id) => nodosMovidos.find((n) => n.id === id).punto);
assert(Math.abs(areaPoligono(puntosMovidos) - 96) < 1e-9, "El área se mantiene EXACTA tras mover el ambiente (traslación rígida, no deformación)");
assert(Math.abs(perimetroPoligono(puntosMovidos) - 40) < 1e-9, "El perímetro se mantiene EXACTO tras mover el ambiente");

// moverNodos no debe tocar nodos que NO pertenecen al grupo movido.
const nodoAjeno = { id: "ajeno", punto: { x: 1, y: 1 } };
const conNodoAjeno = [...nodosOriginales, nodoAjeno];
const resultadoConAjeno = moverNodos(resultado.habitacion.nodoIds, { x: 1, y: 1 }, conNodoAjeno);
const ajenoTrasMover = resultadoConAjeno.find((n) => n.id === "ajeno");
assert(ajenoTrasMover.punto.x === 1 && ajenoTrasMover.punto.y === 1, "moverNodos NO toca nodos ajenos al grupo (no movió el nodo que no pertenecía a la habitación)");

console.log("\nListo.");
