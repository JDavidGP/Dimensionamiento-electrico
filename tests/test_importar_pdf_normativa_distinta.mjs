// Aviso de voltaje fuera de la normativa activa al importar PDF con IA
// local — usuario, 2026-11-28, probando con un PDF de otra normativa a
// la seleccionada: "la normativa no era la adecuada para el PDF que
// leyó, sacó datos e ingresó de todas formas" sin ninguna señal. El
// voltaje que trae el documento se sigue usando TAL CUAL (nunca se
// fuerza al de la normativa activa — podría ser el dato real), pero si
// no figura en la lista de voltajes estándar de esa normativa ahora se
// avisa en la vista previa (nunca bloquea, el usuario decide con el
// checkbox de "incluir").
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
  return [{ nombre: "TD-PRUEBA", tension_v: null, fases: "mono", longitud_alimentador_m: null, circuitos }];
}

// --- 1. PDF con voltaje típico de REBT (230V) pero normativa NEC activa. ---
const r1 = adaptarParaImportar(
  tablero([{ descripcion: "Iluminación", potencia_w: 100, corriente_a: null, voltaje_v: 230, fases: "mono" }]),
  "NEC"
);
const c1 = r1[0].circuitos[0];
assert(
  c1.advertencias.some((a) => a.includes("no es un voltaje estándar de NEC")),
  `Avisa que 230V no es estándar de NEC mono (real: ${JSON.stringify(c1.advertencias)})`
);

// --- 2. Mismo voltaje (230V), normativa IEC_ES (REBT) activa — no debe avisar. ---
const r2 = adaptarParaImportar(
  tablero([{ descripcion: "Iluminación", potencia_w: 100, corriente_a: null, voltaje_v: 230, fases: "mono" }]),
  "IEC_ES"
);
const c2 = r2[0].circuitos[0];
assert(
  !c2.advertencias.some((a) => a.includes("no es un voltaje estándar")),
  `No avisa cuando 230V SÍ es estándar para la normativa activa (real: ${JSON.stringify(c2.advertencias)})`
);

// --- 3. Voltaje estándar de NEC (120V) con NEC activa — no debe avisar. ---
const r3 = adaptarParaImportar(
  tablero([{ descripcion: "Iluminación", potencia_w: 100, corriente_a: null, voltaje_v: 120, fases: "mono" }]),
  "NEC"
);
const c3 = r3[0].circuitos[0];
assert(
  !c3.advertencias.some((a) => a.includes("no es un voltaje estándar")),
  `No avisa cuando el voltaje del documento SÍ es estándar de la normativa activa (real: ${JSON.stringify(c3.advertencias)})`
);

// --- 4. Sin voltaje en el documento: sigue avisando "Sin voltaje...", nunca el nuevo aviso (serían redundantes). ---
const r4 = adaptarParaImportar(
  tablero([{ descripcion: "Iluminación", potencia_w: 100, corriente_a: null, voltaje_v: null, fases: "mono" }]),
  "NEC"
);
const c4 = r4[0].circuitos[0];
assert(
  c4.advertencias.some((a) => a.includes("Sin voltaje en el documento")) &&
    !c4.advertencias.some((a) => a.includes("no es un voltaje estándar")),
  `Sin voltaje: solo el aviso de "sin voltaje", nunca el de normativa distinta (real: ${JSON.stringify(c4.advertencias)})`
);
