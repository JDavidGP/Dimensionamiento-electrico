// Diferencial faltante bajo REBT — ITC-BT-25 §2.1, cita LITERAL
// confirmada contra el texto consolidado oficial del REBT
// (BOE-A-2002-18099-consolidado.pdf): usuario, 2026-11-26, "citar
// normativas para las distancias de instalación" — investigando por
// qué REBT no tenía ninguna cita propia de GFCI/AFCI (a diferencia de
// NEC). Prueba la capa PURA: requiereDiferencialREBT
// (modules/diferencial/index.ts).
import { requiereDiferencialREBT, SENSIBILIDAD_MAXIMA_DIFERENCIAL_GENERAL_MA } from "../src/modules/diferencial/index.ts";

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

// --- 1. Circuito sin diferencialId -> requiere, con cita exacta ---
const sinDiferencial = { id: "c1", diferencialId: null };
const r1 = requiereDiferencialREBT(sinDiferencial);
assert(r1.requiere === true, "Circuito sin diferencialId: requiere");
assert(/ITC-BT-25/.test(r1.motivo), "Cita la sección real (ITC-BT-25)");
assert(new RegExp(`${SENSIBILIDAD_MAXIMA_DIFERENCIAL_GENERAL_MA}mA`).test(r1.motivo), "Cita la sensibilidad exacta (30mA)");

// --- 2. Circuito CON diferencialId -> no requiere, sin motivo ---
const conDiferencial = { id: "c2", diferencialId: "d1" };
const r2 = requiereDiferencialREBT(conDiferencial);
assert(r2.requiere === false && r2.motivo === null, "Circuito con diferencialId: no requiere, sin motivo que citar");

// --- 3. diferencialId undefined (campo nunca seteado) se trata igual que null -> requiere ---
const sinCampo = { id: "c3" };
assert(requiereDiferencialREBT(sinCampo).requiere === true, "diferencialId undefined (nunca seteado) también requiere — no se asume protegido por default");

// --- 4. A diferencia de GFCI/AFCI, NO toma ningún tipo de ambiente — aplica a CUALQUIER circuito, sin excepción ---
assert(requiereDiferencialREBT({ id: "c4", diferencialId: null, tipoAmbiente: "sala" }).requiere === true, "Aplica sin importar el ambiente — REBT no distingue por tipo de ambiente como NEC 210.8");

console.log("\nTodas las pruebas completadas.");
