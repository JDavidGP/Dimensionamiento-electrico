// Protección del transformador bajo IEC_ES (REBT) — usuario,
// 2026-11-21, documentos "protección de transformador" (cita exacta:
// ITC-BT-48 pto.3, "de acuerdo con la placa", SIN % fijo — distinto de
// NEC 450.3(B)) y "tabla de valores normalizados" (serie R10, IEC
// 60947-2 §6.3.2.3). Prueba la capa PURA: seleccionarProteccionTransformadorREBT
// (interruptor general BT = siguiente valor normalizado ≥ In) y
// calcularImpedanciaTransformadorOhm + calcularCortocircuitoTrifasico
// (Icc en los bornes del transformador a partir de %Z de placa).
import {
  seleccionarProteccionTransformadorREBT,
  TAMANOS_ESTANDAR_IEC_60947_2,
  calcularImpedanciaTransformadorOhm,
  calcularCortocircuitoTrifasico,
  calcularCortocircuitoMonofasico,
} from "../src/modules/motor/index.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

// --- 1. seleccionarProteccionTransformadorREBT: siguiente valor normalizado ≥ In ---
// Ejemplo del documento "protección de transformador": 400kVA a 400V trifásico → In = 577.4A → interruptor 630A.
const inSecundario400kVA = 400000 / (Math.sqrt(3) * 400);
assert(Math.abs(inSecundario400kVA - 577.35) < 0.1, `In secundario 400kVA/400V trifásico ≈ 577.4A (real: ${inSecundario400kVA.toFixed(1)}A)`);

const proteccion1 = seleccionarProteccionTransformadorREBT({ corrienteSecundariaA: inSecundario400kVA });
assert(proteccion1.ok && proteccion1.proteccionSecundariaA === 630, `Interruptor general BT propuesto = 630A para In=577.4A (real: ${proteccion1.ok ? proteccion1.proteccionSecundariaA : proteccion1.motivo})`);

// Ejemplo del documento original: 75kVA a 208V trifásico → In = 208.2A → siguiente valor normalizado = 250A.
const inSecundario75kVA = (75 * 1000) / (Math.sqrt(3) * 208);
const proteccion2 = seleccionarProteccionTransformadorREBT({ corrienteSecundariaA: inSecundario75kVA });
assert(proteccion2.ok && proteccion2.proteccionSecundariaA === 250, `Interruptor general BT propuesto = 250A para In=${inSecundario75kVA.toFixed(1)}A (real: ${proteccion2.ok ? proteccion2.proteccionSecundariaA : proteccion2.motivo})`);

// Valor exacto de la tabla no se redondea hacia arriba de más.
const proteccion3 = seleccionarProteccionTransformadorREBT({ corrienteSecundariaA: 630 });
assert(proteccion3.ok && proteccion3.proteccionSecundariaA === 630, "Un In que coincide EXACTO con un valor normalizado no salta al siguiente");

// Sin corriente -> error explícito, no inventa.
const proteccionError = seleccionarProteccionTransformadorREBT({ corrienteSecundariaA: 0 });
assert(!proteccionError.ok, "Sin corriente secundaria, seleccionarProteccionTransformadorREBT falla explícito");

// Fuera de rango de la tabla -> error explícito.
const proteccionFueraDeRango = seleccionarProteccionTransformadorREBT({ corrienteSecundariaA: 99999 });
assert(!proteccionFueraDeRango.ok, "Corriente fuera del rango de la tabla -> falla explícito, no inventa un tamaño");

assert(TAMANOS_ESTANDAR_IEC_60947_2[TAMANOS_ESTANDAR_IEC_60947_2.length - 1] === 6300, "La tabla IEC 60947-2 llega hasta 6300A (serie R10 completa)");

// --- 2. calcularImpedanciaTransformadorOhm + calcularCortocircuitoTrifasico: Icc en bornes ---
// Ejemplo EXACTO del documento: 400kVA, 400V, %Z=4% -> Z=0.016Ω, Icc=14434A.
const impedancia = calcularImpedanciaTransformadorOhm({ capacidadKVA: 400, tensionSecundariaV: 400, impedanciaPct: 4 });
assert(impedancia.disponible, "calcularImpedanciaTransformadorOhm: disponible con todos los datos (trifásico)");
if (impedancia.disponible) {
  assert(Math.abs(impedancia.impedancia.x - 0.016) < 0.0001, `Z_trafo = 0.016Ω para 400kVA/400V/4% (real: ${impedancia.impedancia.x}Ω)`);
  assert(impedancia.impedancia.r === 0, "Reparto R/X: toda la impedancia como reactancia (sin dato de fabricante para repartir)");

  const corto = calcularCortocircuitoTrifasico(400, impedancia.impedancia, 0, 0);
  assert(Math.abs(corto.iccA - 14434) < 5, `Icc en bornes del transformador ≈ 14 434A, exacto contra el documento (real: ${corto.iccA.toFixed(0)}A)`);
}

// --- 3. Monofásico — usuario, 2026-11-21, documento "transformador monofásico" ---
// Ejemplo EXACTO del documento: 50kVA, 240V, %Z=4% -> Z=0.04608Ω, Icc=5208.33A (sin √3, a diferencia del trifásico).
const impedanciaMono = calcularImpedanciaTransformadorOhm({ capacidadKVA: 50, tensionSecundariaV: 240, impedanciaPct: 4 });
assert(impedanciaMono.disponible, "calcularImpedanciaTransformadorOhm: misma fórmula de Z sirve para mono (no hay gate por fases)");
if (impedanciaMono.disponible) {
  assert(Math.abs(impedanciaMono.impedancia.x - 0.04608) < 0.0001, `Z_trafo = 0.04608Ω para 50kVA/240V/4% (real: ${impedanciaMono.impedancia.x}Ω)`);
  const cortoMono = calcularCortocircuitoMonofasico(240, impedanciaMono.impedancia, 0, 0);
  assert(Math.abs(cortoMono.iccA - 5208.33) < 1, `Icc monofásico en bornes ≈5208.33A, exacto contra el documento (real: ${cortoMono.iccA.toFixed(2)}A)`);
}

// Comparación cualitativa del propio documento: mismo kVA/V/uk, el trifásico da Icc MENOR (divide por √3 extra).
const impedancia400V = calcularImpedanciaTransformadorOhm({ capacidadKVA: 50, tensionSecundariaV: 240, impedanciaPct: 4 });
if (impedancia400V.disponible) {
  const cortoTriMismosDatos = calcularCortocircuitoTrifasico(240, impedancia400V.impedancia, 0, 0);
  const cortoMonoMismosDatos = calcularCortocircuitoMonofasico(240, impedancia400V.impedancia, 0, 0);
  assert(Math.abs(cortoMonoMismosDatos.iccA - cortoTriMismosDatos.iccA * Math.sqrt(3)) < 1, "Mono = √3 × trifásico para los mismos kVA/V/%Z (mismo Z, difiere solo en la fórmula de conversión a corriente)");
}

// Sin %Z de placa -> no disponible, motivo explícito.
const impedanciaSinZ = calcularImpedanciaTransformadorOhm({ capacidadKVA: 400, tensionSecundariaV: 400, impedanciaPct: "" });
assert(!impedanciaSinZ.disponible, "Sin %Z de placa, calcularImpedanciaTransformadorOhm no disponible (no inventa un %Z típico)");

console.log("\nTodas las pruebas completadas.");
