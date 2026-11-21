import { interpretarTexto } from "../src/modules/importacionEquipos/index.ts";

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

// --- Caso básico: 2 bloques, varios equipos ---
const texto1 = `
TD1-C3
5 Bombillo 40W
35 Bombillo 20W

TD1-C4
1 Refrigerador 1200W
`;
const r1 = interpretarTexto(texto1);
assert(r1.length === 3, `3 líneas de equipo interpretadas (real: ${r1.length})`);
assert(r1.every((f) => f.ok), "Las 3 son válidas (ok:true)");
assert(r1[0].etiquetaCircuito === "TD1-C3" && r1[1].etiquetaCircuito === "TD1-C3", "Las primeras 2 quedan bajo TD1-C3");
assert(r1[2].etiquetaCircuito === "TD1-C4", "La 3ra queda bajo TD1-C4 (el encabezado cambió de bloque)");
assert(r1[0].cantidad === "5" && r1[0].nombre === "Bombillo" && r1[0].valor === "40" && r1[0].modoEntrada === "potencia", "La 1ra línea se parsea cantidad/nombre/valor/modo correctamente");
assert(r1[2].nombre === "Refrigerador" && r1[2].valor === "1200", "Nombre con mayúscula y valor de 4 dígitos se parsean bien");

// --- Nombre con espacios y número en el medio (no debe confundirse con el valor) ---
const texto2 = `TD1-C5\n2 Aire acondicionado 12000 BTU 1500W`;
const r2 = interpretarTexto(texto2);
assert(r2.length === 1 && r2[0].ok, "Nombre con números intermedios se interpreta como 1 sola línea válida");
assert(r2[0].nombre === "Aire acondicionado 12000 BTU", `El nombre completo (con el número intermedio) se preserva (real: "${r2[0].nombre}")`);
assert(r2[0].valor === "1500", `El valor tomado es el ÚLTIMO número antes de la unidad, no el intermedio (real: ${r2[0].valor})`);

// --- Corriente en vez de potencia (sufijo A) ---
const texto3 = `TD2-C1\n3 Motor 15A`;
const r3 = interpretarTexto(texto3);
assert(r3[0].modoEntrada === "corriente", "El sufijo 'A' se interpreta como modoEntrada='corriente'");
assert(r3[0].valor === "15", "El valor en amperios se parsea igual");

// --- Línea de equipo sin encabezado previo -> error, nunca se adivina el circuito ---
const texto4 = `5 Bombillo 40W`;
const r4 = interpretarTexto(texto4);
assert(r4.length === 1 && r4[0].ok === false, "Una línea de equipo SIN etiqueta previa se reporta como error");
assert(/falta indicar/.test(r4[0].motivo), "El motivo del error explica que falta la etiqueta del circuito");

// --- Líneas en blanco se ignoran, no rompen nada ---
const texto5 = `\n\nTD1-C3\n\n5 Bombillo 40W\n\n\n`;
const r5 = interpretarTexto(texto5);
assert(r5.length === 1 && r5[0].ok, "Líneas en blanco entre medio no rompen el parseo");

// --- Texto vacío -> sin resultados, sin explotar ---
assert(interpretarTexto("").length === 0, "Texto vacío da una lista vacía, sin error");
assert(interpretarTexto(null).length === 0, "null no rompe interpretarTexto (cae a '')");

console.log("\nListo.");
