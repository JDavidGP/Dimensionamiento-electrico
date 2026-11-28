// "Circuitos" huérfanos de dispositivos del cuadro general — usuario,
// 2026-11-28, probando con una memoria técnica REBT real (ICP, IGA,
// diferencial, protector de sobretensiones y PIA en la sección del
// Cuadro General de Mando y Protección): la IA local confundió esos 5
// DISPOSITIVOS del tablero con circuitos reales, generando 5 "circuitos"
// sin ninguna carga (0 equipos, 0W) y dejando la tabla REAL de
// distribución de circuitos (C1-C5, con potencia real) sin extraer.
// ollamaClient.ts ahora instruye explícitamente a no confundirlos (ver
// su INSTRUCCION_SISTEMA), pero un modelo local chico puede seguir
// equivocándose — esta prueba cubre la RED DE SEGURIDAD en la capa
// pura (adaptador.ts): un "circuito" sin NINGÚN dato numérico (ni
// voltaje, ni potencia, ni corriente) no viene premarcado para incluir,
// y su advertencia nombra explícitamente la sospecha (dispositivo del
// cuadro, no un circuito real).
import { adaptarParaImportar } from "../src/modules/iaLocal/adaptador.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

function tablero(circuitos) {
  return [{ nombre: "CGMP", tension_v: 230, fases: "mono", longitud_alimentador_m: null, circuitos }];
}

// --- 1. "Circuito" sin ningún dato (caso real: "Interruptor General Automático (IGA)") — no debe venir premarcado. ---
const r1 = adaptarParaImportar(
  tablero([{ descripcion: "Interruptor General Automático (IGA)", potencia_w: null, corriente_a: null, voltaje_v: null, fases: null }]),
  "IEC_ES"
);
const c1 = r1[0].circuitos[0];
assert(c1.incluir === false, `Un "circuito" sin ningún dato numérico NO viene premarcado para incluir (real: ${c1.incluir})`);
assert(c1.valido === true, "...pero sigue siendo 'válido' (el usuario puede tildarlo a mano si de verdad quiere incluirlo)");
assert(
  c1.advertencias.some((a) => a.includes("DISPOSITIVO del tablero") && a.includes("no un circuito real")),
  `Su advertencia nombra la sospecha concreta (dispositivo del cuadro, no carga real) (real: ${JSON.stringify(c1.advertencias)})`
);

// --- 2. Mismo circuito, pero CON potencia — sí es un circuito real, debe incluirse normal. ---
const r2 = adaptarParaImportar(
  tablero([{ descripcion: "Puntos de iluminación (todos los ambientes)", potencia_w: 200, corriente_a: null, voltaje_v: null, fases: null }]),
  "IEC_ES"
);
const c2 = r2[0].circuitos[0];
assert(c2.incluir === true, `Un circuito CON potencia real sí viene premarcado para incluir (real: ${c2.incluir})`);
assert(
  !c2.advertencias.some((a) => a.includes("DISPOSITIVO del tablero")),
  "...y no lleva la advertencia de 'sospecha de dispositivo' (si tiene carga, no aplica)"
);

// --- 3. Solo con corriente de breaker (sin potencia) — tampoco es "sin ningún dato", sigue incluido (ya avisa por otro lado: aproximación). ---
const r3 = adaptarParaImportar(
  tablero([{ descripcion: "Tomas de corriente de uso general", potencia_w: null, corriente_a: 16, voltaje_v: null, fases: null }]),
  "IEC_ES"
);
const c3 = r3[0].circuitos[0];
assert(c3.incluir === true, `Con solo corriente (sin potencia) sigue premarcado para incluir (real: ${c3.incluir})`);

console.log("\nPruebas completas.");
