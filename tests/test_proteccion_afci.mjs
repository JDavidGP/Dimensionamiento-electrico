// Protección AFCI por tipo de ambiente — NEC 210.12(B), cita de
// SECCIÓN confirmada por el usuario (no texto literal, ver la nota de
// cabecera en modules/plano/proteccionAFCI.ts). Prueba la capa PURA:
// requiereProteccionAFCI.
import { requiereProteccionAFCI, OPCIONES_TIPO_AMBIENTE } from "../src/modules/plano/index.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

// --- 1. Ambiente "otro" (default) -> no requiere ---
const otro = requiereProteccionAFCI("otro");
assert(otro.requiere === false && otro.motivo === null, "Ambiente 'otro' (default) -> no requiere AFCI");

// --- 2. Cada ambiente de la lista AFCI -> requiere, citando 210.12(B) ---
for (const tipo of ["dormitorio", "sala", "comedor", "pasillo", "closet", "cocina", "lavanderia"]) {
  const r = requiereProteccionAFCI(tipo);
  assert(r.requiere === true && /210\.12\(B\)/.test(r.motivo), `Ambiente '${tipo}' -> requiere AFCI citando 210.12(B) (real: ${JSON.stringify(r)})`);
}

// --- 3. Baño/Garaje/Sótano sin terminar -> NUNCA requieren AFCI (solo GFCI), aunque estén en la lista de ambientes ---
for (const tipo of ["bano", "garage", "sotano_sin_terminar"]) {
  const r = requiereProteccionAFCI(tipo);
  assert(r.requiere === false, `Ambiente '${tipo}' -> NUNCA requiere AFCI (solo GFCI) (real: ${JSON.stringify(r)})`);
}

// --- 4. tipoAmbiente null/undefined -> no requiere, no revienta ---
assert(requiereProteccionAFCI(null).requiere === false, "tipoAmbiente null -> no requiere, sin reventar");
assert(requiereProteccionAFCI(undefined).requiere === false, "tipoAmbiente undefined -> no requiere, sin reventar");

// --- 5. OPCIONES_TIPO_AMBIENTE (compartida con GFCI) ya trae los nuevos tipos de AFCI ---
const valores = OPCIONES_TIPO_AMBIENTE.map((o) => o.valor);
for (const tipo of ["dormitorio", "sala", "comedor", "pasillo", "closet"]) {
  assert(valores.includes(tipo), `OPCIONES_TIPO_AMBIENTE incluye '${tipo}' (nuevo, agregado para AFCI)`);
}

console.log("\nTodas las pruebas completadas.");
