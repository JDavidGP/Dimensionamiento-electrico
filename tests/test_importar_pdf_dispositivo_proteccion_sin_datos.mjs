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
  c1.advertencias.some((a) => a.includes("DISPOSITIVO de protección del cuadro general") && a.includes("no un circuito con carga propia")),
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
  !c2.advertencias.some((a) => a.includes("DISPOSITIVO de protección del cuadro general")),
  "...y no lleva la advertencia de 'sospecha de dispositivo' (si tiene carga, no aplica)"
);

// --- 3. Solo con corriente de breaker (sin potencia) — tampoco es "sin ningún dato", sigue incluido (ya avisa por otro lado: aproximación). ---
const r3 = adaptarParaImportar(
  tablero([{ descripcion: "Tomas de corriente de uso general", potencia_w: null, corriente_a: 16, voltaje_v: null, fases: null }]),
  "IEC_ES"
);
const c3 = r3[0].circuitos[0];
assert(c3.incluir === true, `Con solo corriente (sin potencia) sigue premarcado para incluir (real: ${c3.incluir})`);

// --- 4-6. SEGUNDA VUELTA del mismo bug real (usuario, 2026-11-28, mismo
//     PDF): esta vez la IA SÍ le puso una corriente a cada "dispositivo"
//     — pero es la corriente NOMINAL DEL DISPOSITIVO (25A del ICP, 25A
//     del IGA, 40A del diferencial, tal como figuran en el documento),
//     no la de ninguna carga. Sin este caso, el fallback de "corriente
//     de breaker como aproximación" (caso 3 arriba) fabricaba una
//     demanda irreal (20700W/90A de la nada, en la corrida real). ---
function probarDispositivoConCorriente(descripcion, corriente_a) {
  const r = adaptarParaImportar(tablero([{ descripcion, potencia_w: null, corriente_a, voltaje_v: null, fases: null }]), "IEC_ES");
  return r[0].circuitos[0];
}

const c4 = probarDispositivoConCorriente("Interruptor General Automático (IGA)", 25);
assert(c4.incluir === false, `IGA con su corriente nominal (25A) tampoco viene premarcado para incluir (real: ${c4.incluir})`);
assert(c4.equipoForm === null, "...y NO se le fabrica un equipo de carga a partir de esos 25A (serían del dispositivo, no de una carga)");
assert(
  c4.advertencias.some((a) => a.includes("DISPOSITIVO de protección del cuadro") && a.includes("25A") && a.includes("NO se usó como aproximación de carga")),
  `Su advertencia explica que esos 25A NO se usaron como carga (real: ${JSON.stringify(c4.advertencias)})`
);
assert(
  !c4.advertencias.some((a) => a.includes("se usó el amperaje del breaker") && a.includes("como aproximación, probablemente sobreestima")),
  "...y NO lleva el mensaje de 'aproximación de carga' (ese es para circuitos reales sin potencia, no para dispositivos)"
);

const c5 = probarDispositivoConCorriente("Interruptor de Control de Potencia (ICP)", 25);
assert(c5.incluir === false && c5.equipoForm === null, `Mismo caso para el ICP (real: incluir=${c5.incluir}, equipoForm=${JSON.stringify(c5.equipoForm)})`);

const c6 = probarDispositivoConCorriente("Interruptor Diferencial (ID)", 40);
assert(c6.incluir === false && c6.equipoForm === null, `Mismo caso para el diferencial, con su propia corriente nominal (40A) (real: incluir=${c6.incluir}, equipoForm=${JSON.stringify(c6.equipoForm)})`);

console.log("\nPruebas completas.");
