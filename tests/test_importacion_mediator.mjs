import { ImportacionMediator } from "../src/core/mediators/ImportacionMediator.js";

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

const circuitos = [
  { id: "c-td1c3", etiqueta: "TD1-C3", nombre: "Iluminación sala", tableroId: "t1" },
  { id: "c-td1c4", etiqueta: "TD1-C4", nombre: "Tomas cocina", tableroId: "t1" },
  { id: "c-dup-a", etiqueta: "DUP", nombre: "Duplicado A", tableroId: "t1" },
  { id: "c-dup-b", etiqueta: "DUP", nombre: "Duplicado B", tableroId: "t1" },
];

// --- Caso feliz: 2 bloques válidos ---
const texto = `
TD1-C3
5 Bombillo 40W
35 Bombillo 20W

TD1-C4
1 Refrigerador 1200W
`;
const filas = ImportacionMediator.previsualizar(texto, circuitos);
assert(filas.length === 3, `3 filas devueltas (real: ${filas.length})`);
assert(filas.every((f) => f.ok), "Las 3 filas son válidas");
assert(filas[0].equipo.circuitoId === "c-td1c3" && filas[1].equipo.circuitoId === "c-td1c3", "Los 2 primeros equipos quedan vinculados al circuito TD1-C3 real (por id, no por etiqueta)");
assert(filas[2].equipo.circuitoId === "c-td1c4", "El 3er equipo queda vinculado a TD1-C4");
assert(filas[0].equipo.nombre === "Bombillo" && filas[0].equipo.cantidad === 5 && filas[0].equipo.valor === 40, "El equipo armado tiene los campos numéricos YA convertidos (cantidad/valor como number, no string)");
assert(filas[0].equipo.cosPhi === 1 && filas[0].equipo.tipoEquipoNEC === "CARGA_GENERAL", "Toma los defaults seguros (cosPhi=1, tipo=CARGA_GENERAL) cuando el texto no los especifica");
assert(typeof filas[0].equipo.id === "string" && filas[0].equipo.id.length > 0, "Cada equipo generado tiene un id propio (mismo generarId() que el resto de la app)");

// --- Circuito que no existe -> rechazado, nunca se crea ---
const textoInexistente = `TD9-C9\n2 Lámpara 10W`;
const filasInexistente = ImportacionMediator.previsualizar(textoInexistente, circuitos);
assert(filasInexistente[0].ok === false, "Una etiqueta de circuito que no existe se rechaza");
assert(/No existe ningún circuito/.test(filasInexistente[0].motivo), "El motivo explica que el circuito no existe");

// --- Etiqueta duplicada entre 2 circuitos -> ambigüedad, se rechaza (nunca adivina) ---
const textoDuplicado = `DUP\n1 Ventilador 60W`;
const filasDuplicado = ImportacionMediator.previsualizar(textoDuplicado, circuitos);
assert(filasDuplicado[0].ok === false, "Una etiqueta compartida por 2+ circuitos se rechaza (no es un circuito único)");
assert(/no se puede saber a cuál/.test(filasDuplicado[0].motivo), "El motivo explica la ambigüedad de la etiqueta duplicada");

// --- Datos inválidos (valor 0) -> rechazado por la MISMA validación que el formulario manual ---
const textoInvalido = `TD1-C3\n2 Bombillo roto 0W`;
const filasInvalido = ImportacionMediator.previsualizar(textoInvalido, circuitos);
assert(filasInvalido[0].ok === false, "Un valor de 0W se rechaza (misma regla que el formulario manual: debe ser > 0)");
assert(/mayor a 0/.test(filasInvalido[0].motivo), "El motivo es el mismo mensaje de validarEquipo (potencia debe ser mayor a 0 W)");

// --- Reporte línea-por-línea: un bloque con una línea válida y otra inválida reporta cada una por separado ---
const textoMixto = `TD1-C3\n5 Bombillo 40W\n3 Bombillo roto 0W`;
const filasMixto = ImportacionMediator.previsualizar(textoMixto, circuitos);
assert(filasMixto.length === 2 && filasMixto[0].ok === true && filasMixto[1].ok === false, "Un bloque mixto reporta CADA línea por separado (una ok, la otra no)");

console.log("\nListo.");
