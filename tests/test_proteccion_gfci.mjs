// Protección GFCI por tipo de ambiente — NEC 210.8(A)/(B), cita de
// SECCIÓN confirmada por el usuario (no texto literal, ver la nota de
// cabecera en modules/plano/proteccionGFCI.ts). Prueba la capa PURA:
// requiereProteccionGFCI.
import { requiereProteccionGFCI, OPCIONES_TIPO_AMBIENTE } from "../src/modules/plano/index.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

// --- 1. Ambiente "otro" (default), ni exterior -> no requiere ---
const otro = requiereProteccionGFCI("otro", false, true);
assert(otro.requiere === false && otro.motivo === null, "Ambiente 'otro' (default), no exterior -> no requiere GFCI");

// --- 2. Cada tipo de ambiente de la lista SÍ requiere, residencial -> cita 210.8(A) ---
for (const tipo of ["bano", "cocina", "garage", "lavanderia", "sotano_sin_terminar"]) {
  const r = requiereProteccionGFCI(tipo, false, true);
  assert(r.requiere === true && /210\.8\(A\)/.test(r.motivo), `Ambiente '${tipo}', residencial -> requiere GFCI citando 210.8(A) (real: ${JSON.stringify(r)})`);
}

// --- 3. Mismos ambientes, NO residencial -> cita 210.8(B) en vez de (A) ---
const cocinaComercial = requiereProteccionGFCI("cocina", false, false);
assert(cocinaComercial.requiere === true && /210\.8\(B\)/.test(cocinaComercial.motivo), `Ambiente 'cocina', NO residencial -> cita 210.8(B) (real: '${cocinaComercial.motivo}')`);

// --- 4. Exterior (el flag, no un tipoAmbiente) -> requiere, sin importar el tipo de ambiente ---
const exteriorOtro = requiereProteccionGFCI("otro", true, true);
assert(exteriorOtro.requiere === true && /210\.8\(A\)/.test(exteriorOtro.motivo), `Exterior=true (aunque tipoAmbiente sea 'otro') -> requiere GFCI (real: ${JSON.stringify(exteriorOtro)})`);

// --- 5. Exterior gana aunque el tipoAmbiente sea null/undefined ---
const exteriorSinTipo = requiereProteccionGFCI(null, true, true);
assert(exteriorSinTipo.requiere === true, "Exterior=true incluso sin tipoAmbiente definido -> requiere GFCI");

// --- 6. tipoAmbiente null + no exterior -> no requiere, no revienta ---
const nulo = requiereProteccionGFCI(null, false, true);
assert(nulo.requiere === false, "tipoAmbiente null, no exterior -> no requiere, sin reventar");

// --- 7. OPCIONES_TIPO_AMBIENTE trae al menos los 6 tipos de GFCI, "otro" primero (default) ---
// Compartida con AFCI (ver modules/plano/tipoAmbiente.ts) — no se fija
// un total exacto acá, solo que los de GFCI siguen presentes.
const valoresGFCI = OPCIONES_TIPO_AMBIENTE.map((o) => o.valor);
assert(OPCIONES_TIPO_AMBIENTE[0].valor === "otro", "OPCIONES_TIPO_AMBIENTE trae 'otro' primero (default)");
for (const tipo of ["bano", "cocina", "garage", "lavanderia", "sotano_sin_terminar"]) {
  assert(valoresGFCI.includes(tipo), `OPCIONES_TIPO_AMBIENTE sigue incluyendo '${tipo}' (de GFCI)`);
}

console.log("\nTodas las pruebas completadas.");
