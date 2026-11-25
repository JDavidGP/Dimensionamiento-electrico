// Plausibilidad breaker↔carga en la importación de PDF con IA local —
// usuario, 2026-11-25, tras pasarle una memoria técnica real de 8
// páginas (con contenido duplicado) y reportar "valida todo de una, no
// hay ninguna marca de advertencia": la IA local devolvió el mismo
// amperaje — el de la acometida COMPLETA (Iprot = 113.9A) — como
// breaker de CADA circuito, desde una luz de 480W hasta una ducha de
// 4500W. esquema.ts solo valida que corriente_a esté en un rango
// físico posible EN SÍ MISMO (0.01–10000A) — 113.9A pasa sin problema,
// pero es absurdo para una lámpara. Prueba la capa PURA:
// adaptarParaImportar (modules/iaLocal/adaptador.ts) cruzando
// corriente_a contra la carga real (potencia_w/voltaje_v) de CADA
// circuito.
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
  return [{ nombre: "TD-PRUEBA", tension_v: 120, fases: "mono", longitud_alimentador_m: null, circuitos }];
}

// --- 1. Caso real reportado: breaker de la ACOMETIDA (113.9A) repetido
//     en un circuito de iluminación de 480W/120V (carga real ≈4A) —
//     debe avisar que es desproporcionado. ---
const r1 = adaptarParaImportar(
  tablero([{ descripcion: "Iluminación Entrada, Sala de Estar, Comedor y Cocina", potencia_w: 480, corriente_a: 113.9, voltaje_v: 120, fases: "mono" }]),
  "NEC"
);
const c1 = r1[0].circuitos[0];
assert(
  c1.advertencias.some((a) => a.includes("parece desproporcionado")),
  `Avisa que el breaker (113.9A) es desproporcionado para 480W/120V (≈4A) (real: ${JSON.stringify(c1.advertencias)})`
);
assert(c1.equipoForm.valor === "480", "Sigue usando la POTENCIA real (480W) para el equipo, no el breaker de la acometida");
assert(c1.valido, "El circuito sigue siendo válido (la advertencia no lo bloquea, el usuario decide)");

// --- 2. Breaker MENOR que la carga estimada (físicamente imposible en
//     una instalación real) — también debe avisar. ---
const r2 = adaptarParaImportar(
  tablero([{ descripcion: "Circuito subdimensionado", potencia_w: 3000, corriente_a: 10, voltaje_v: 120, fases: "mono" }]), // 3000W/120V=25A, breaker 10A < 25A
  "NEC"
);
const c2 = r2[0].circuitos[0];
assert(
  c2.advertencias.some((a) => a.includes("es MENOR que la corriente estimada")),
  `Avisa que el breaker (10A) es menor que la carga estimada (25A) (real: ${JSON.stringify(c2.advertencias)})`
);

// --- 3. Breaker PLAUSIBLE para la carga (caso normal, margen típico de
//     protección) — NO debe avisar nada sobre esto. ---
const r3 = adaptarParaImportar(
  tablero([{ descripcion: "Tomacorrientes cocina", potencia_w: 1500, corriente_a: 20, voltaje_v: 120, fases: "mono" }]), // 1500W/120V=12.5A, breaker 20A — margen normal (1.6x)
  "NEC"
);
const c3 = r3[0].circuitos[0];
assert(
  !c3.advertencias.some((a) => a.includes("desproporcionado") || a.includes("es MENOR que")),
  `Un breaker con margen normal NO dispara ninguna advertencia de plausibilidad (real: ${JSON.stringify(c3.advertencias)})`
);

// --- 4. Motor con alto margen de arranque (NEC 430) — no debe generar
//     un falso positivo solo por ser un breaker varias veces la carga
//     nominal continua (factor razonable hasta 8x). ---
const r4 = adaptarParaImportar(
  tablero([{ descripcion: "Electrobomba 1 HP", potencia_w: 1100, corriente_a: 20, voltaje_v: 240, fases: "bi" }]), // 1100W/240V≈4.58A, breaker 20A ≈4.4x — razonable para un motor
  "NEC"
);
const c4 = r4[0].circuitos[0];
assert(
  !c4.advertencias.some((a) => a.includes("desproporcionado")),
  `Un breaker de motor con margen de arranque razonable (≈4.4x) NO dispara un falso positivo (real: ${JSON.stringify(c4.advertencias)})`
);

// --- 5. Solo corriente (sin potencia) — el chequeo de plausibilidad NO
//     aplica (no hay carga real con qué comparar); sigue el aviso YA
//     existente de "aproximación", sin uno nuevo encima. ---
const r5 = adaptarParaImportar(tablero([{ descripcion: "Solo breaker", potencia_w: null, corriente_a: 113.9, voltaje_v: 120, fases: "mono" }]), "NEC");
const c5 = r5[0].circuitos[0];
assert(
  !c5.advertencias.some((a) => a.includes("desproporcionado") || a.includes("es MENOR que")),
  `Sin potencia real, el chequeo de plausibilidad NO se dispara (nada con qué comparar) (real: ${JSON.stringify(c5.advertencias)})`
);
assert(c5.advertencias.some((a) => a.includes("aproximación")), "Sigue avisando que se usó el breaker como aproximación (comportamiento ya existente, sin tocar)");

// --- 6. Solo potencia (sin breaker) — tampoco aplica (nada con qué cruzar). ---
const r6 = adaptarParaImportar(tablero([{ descripcion: "Solo potencia", potencia_w: 480, corriente_a: null, voltaje_v: 120, fases: "mono" }]), "NEC");
const c6 = r6[0].circuitos[0];
assert(
  !c6.advertencias.some((a) => a.includes("desproporcionado") || a.includes("es MENOR que")),
  `Sin breaker del documento, el chequeo de plausibilidad NO se dispara (real: ${JSON.stringify(c6.advertencias)})`
);

console.log("\nTodas las pruebas de plausibilidad breaker↔carga ejecutadas.");
