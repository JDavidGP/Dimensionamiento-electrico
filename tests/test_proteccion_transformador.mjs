// Protección de sobrecorriente del transformador — NEC Tabla 450.3(B)
// (usuario, 2026-11-21, subió la tabla con datos duros). Prueba contra
// el ejemplo numérico EXACTO del propio documento: 75kVA 480V→208Y/120V
// trifásico, antes de confiar en la función para cualquier otro caso.
import { ApplicationMediator as App } from "../src/core/ApplicationMediator.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

// --- 1. Corrientes nominales del ejemplo del documento: 75kVA 480→208Y/120V trifásico ---
const transformador = { capacidadKVA: 75, fases: "tri", tensionPrimariaV: 480, tensionSecundariaV: 208 };
const corrientes = App.origen.calcularCorrientesNominales(transformador);
assert(corrientes.disponible, "Corrientes nominales disponibles con datos completos");
assert(Math.abs(corrientes.corrientePrimariaA - 90.2) < 0.1, `Corriente primaria ≈ 90.2A (real: ${corrientes.corrientePrimariaA?.toFixed(2)})`);
assert(Math.abs(corrientes.corrienteSecundariaA - 208.2) < 0.1, `Corriente secundaria ≈ 208.2A (real: ${corrientes.corrienteSecundariaA?.toFixed(2)})`);

// --- 2. Esquema primario + secundario: 250% primario (redondea ABAJO), 125% secundario (redondea ARRIBA, Nota 1) ---
const proteccion = App.origen.seleccionarProteccionTransformador({
  corrientePrimariaA: corrientes.corrientePrimariaA,
  corrienteSecundariaA: corrientes.corrienteSecundariaA,
  esquema: "primario_y_secundario",
});
assert(proteccion.ok, "Protección calculada con éxito");
assert(proteccion.proteccionPrimariaA === 225, `Primario: 250% de 90.2A = 225.5A → redondea ABAJO → 225A (real: ${proteccion.proteccionPrimariaA})`);
assert(proteccion.proteccionSecundariaA === 300, `Secundario: 125% de 208.2A = 260.2A → redondea ARRIBA (Nota 1) → 300A (real: ${proteccion.proteccionSecundariaA})`);

// --- 3. Esquema solo primario, corriente ≥9A: 125%, redondea ARRIBA ---
const soloPrimarioAlto = App.origen.seleccionarProteccionTransformador({ corrientePrimariaA: 90.2, esquema: "solo_primario" });
assert(soloPrimarioAlto.ok && soloPrimarioAlto.proteccionSecundariaA === null, "Solo primario: no calcula protección secundaria");
assert(soloPrimarioAlto.porcentajePrimario === 125, `Solo primario, ≥9A usa 125% (real: ${soloPrimarioAlto.porcentajePrimario}%)`);

// --- 4. Esquema solo primario, corriente entre 2 y 9A: 167%, redondea ABAJO ---
// (con la lista estándar NEC real el resultado da ok:false porque 167% de
// 5A=8.35A queda por debajo del tamaño más chico, 15A — caso ya cubierto
// en el punto siguiente; acá se usa una lista reducida propia del test
// para aislar y confirmar el % elegido, no la disponibilidad de tamaños)
const soloPrimarioMedio = App.origen.seleccionarProteccionTransformador({ corrientePrimariaA: 5, esquema: "solo_primario", tamanosEstandar: [1, 2, 5, 8, 10, 15] });
assert(soloPrimarioMedio.ok && soloPrimarioMedio.porcentajePrimario === 167, `Solo primario, 2-9A usa 167% (real: ${soloPrimarioMedio.porcentajePrimario}%)`);
assert(soloPrimarioMedio.proteccionPrimariaA === 8, `167% de 5A = 8.35A → redondea ABAJO → 8A de la lista reducida (real: ${soloPrimarioMedio.proteccionPrimariaA})`);

// --- 5. Esquema solo primario, corriente <2A: 300%, redondea ABAJO ---
const soloPrimarioBajo = App.origen.seleccionarProteccionTransformador({ corrientePrimariaA: 1, esquema: "solo_primario", tamanosEstandar: [1, 2, 3, 5, 10, 15] });
assert(soloPrimarioBajo.ok && soloPrimarioBajo.porcentajePrimario === 300, `Solo primario, <2A usa 300% (real: ${soloPrimarioBajo.porcentajePrimario}%)`);
assert(soloPrimarioBajo.proteccionPrimariaA === 3, `300% de 1A = 3A → tamaño exacto de la lista reducida (real: ${soloPrimarioBajo.proteccionPrimariaA})`);

// --- 4b. Con la lista estándar NEC real: 167% de 5A (8.35A) no alcanza ningún tamaño (el más chico es 15A) ---
const soloPrimarioMedioReal = App.origen.seleccionarProteccionTransformador({ corrientePrimariaA: 5, esquema: "solo_primario" });
assert(!soloPrimarioMedioReal.ok, `Con la lista NEC real, 167% de 5A (8.35A) queda sin protección válida — no se inventa un tamaño (real: ok=${soloPrimarioMedioReal.ok})`);

// --- 6. Sin corriente primaria: error claro, no inventa nada ---
const sinDatos = App.origen.seleccionarProteccionTransformador({ corrientePrimariaA: 0, esquema: "solo_primario" });
assert(!sinDatos.ok && /Falta la corriente/.test(sinDatos.motivo), "Sin corriente primaria, error claro (no inventa un valor)");

// --- 7. Esquema primario_y_secundario sin corriente secundaria: error claro ---
const sinSecundaria = App.origen.seleccionarProteccionTransformador({ corrientePrimariaA: 90.2, esquema: "primario_y_secundario" });
assert(!sinSecundaria.ok && /secundaria/.test(sinSecundaria.motivo), "Esquema primario+secundario sin corriente secundaria, error claro");

console.log("\nTodas las pruebas completadas.");
