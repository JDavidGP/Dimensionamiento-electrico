// Caída de tensión REBT — ITC-BT-19 §2.2.2 (usuario, 2026-11-21,
// citas confirmadas: tabla vivienda/otras/transformador propio +
// clasificación de circuito mixto como "alumbrado"). Prueba la capa
// PURA (claseCircuitoREBT, IEC_ES.limiteCaidaTensionTramoPct/
// limiteCaidaTensionAcumuladaPct, calcularCircuito con contexto,
// evaluarCaidaAcumulada con override) ANTES de tocar los mediadores.
import { claseCircuitoREBT, calcularCircuito, evaluarCaidaAcumulada } from "../src/modules/motor/index.ts";
import { IEC_ES } from "../src/modules/normativa/iec/es.ts";
import { NEC } from "../src/modules/normativa/nec.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

// --- 1. claseCircuitoREBT: puro ---
assert(claseCircuitoREBT([{ tipoEquipoNEC: "ILUMINACION_GENERAL" }]) === "alumbrado", "Un equipo de iluminación → alumbrado");
assert(claseCircuitoREBT([{ tipoEquipoNEC: "CARGA_GENERAL" }]) === "otros_usos", "Sin iluminación → otros_usos");
assert(
  claseCircuitoREBT([{ tipoEquipoNEC: "ILUMINACION_GENERAL" }, { tipoEquipoNEC: "CARGA_GENERAL" }]) === "alumbrado",
  "Mixto (luminarias + tomas) → alumbrado, el más restrictivo (cita confirmada por el usuario)"
);
assert(claseCircuitoREBT([]) === "otros_usos", "Sin equipos → otros_usos (caso borde, no debería llegar acá en la práctica)");

// --- 2. Tabla IEC_ES.limiteCaidaTensionTramoPct / limiteCaidaTensionAcumuladaPct ---
const casos = [
  { tipoInstalacion: "residencial_basico", claseCircuito: "alumbrado", tieneTransformadorPropio: false, esperado: 3.0, label: "Vivienda, alumbrado" },
  { tipoInstalacion: "residencial_avanzado", claseCircuito: "otros_usos", tieneTransformadorPropio: false, esperado: 3.0, label: "Vivienda, otros usos (sigue siendo 3%, sin distinción)" },
  { tipoInstalacion: "comercial_industrial", claseCircuito: "alumbrado", tieneTransformadorPropio: false, esperado: 3.0, label: "Otras instalaciones SIN transformador, alumbrado" },
  { tipoInstalacion: "comercial_industrial", claseCircuito: "otros_usos", tieneTransformadorPropio: false, esperado: 5.0, label: "Otras instalaciones SIN transformador, otros usos" },
  { tipoInstalacion: "comercial_industrial", claseCircuito: "alumbrado", tieneTransformadorPropio: true, esperado: 4.5, label: "Industrial CON transformador propio, alumbrado" },
  { tipoInstalacion: "comercial_industrial", claseCircuito: "otros_usos", tieneTransformadorPropio: true, esperado: 6.5, label: "Industrial CON transformador propio, otros usos" },
];
for (const c of casos) {
  const tramo = IEC_ES.limiteCaidaTensionTramoPct(c);
  const acumulada = IEC_ES.limiteCaidaTensionAcumuladaPct(c);
  assert(tramo === c.esperado, `${c.label} — tramo ${c.esperado}% (real: ${tramo}%)`);
  assert(acumulada === c.esperado, `${c.label} — acumulada ${c.esperado}% (real: ${acumulada}%)`);
}

// --- 3. NEC/CIEN no definen el override — comportamiento sin cambios ---
assert(NEC.limiteCaidaTensionTramoPct === undefined, "NEC no define limiteCaidaTensionTramoPct — sigue usando el número fijo");
assert(NEC.limiteCaidaTensionPct === 3.0, "NEC.limiteCaidaTensionPct sigue en 3% fijo, sin cambios");

// --- 4. calcularCircuito aplica el override: circuito que pasa con 5% pero falla con 3% ---
// Circuito "otros usos" (tomacorriente), distancia larga, calibrado para
// que la caída de UN tramo caiga justo entre 3% y 5% — distinto
// resultado según contexto.
const circuitoBase = { id: "c1", nombre: "Circuito test", tipo: "dedicado", fases: "mono", material: "cobre", voltaje: 230, distancia: 55, temp: 30 };
const equipoFuerza = [{ nombre: "Tomacorriente", modoEntrada: "potencia", valor: 2000, cosPhi: 1, tipoEquipoNEC: "CARGA_GENERAL" }];

const sinTransformador = calcularCircuito(circuitoBase, equipoFuerza, IEC_ES, { tipoInstalacion: "comercial_industrial", tieneTransformadorPropio: false });
// otros_usos sin transformador -> límite 5%, debería poder encontrar un calibre
assert(sinTransformador.ok, `Otros usos, SIN transformador (límite 5%) — debería dimensionar (real: ok=${sinTransformador.ok}, ${sinTransformador.error ?? ""})`);
if (sinTransformador.ok) {
  assert(sinTransformador.claseCircuitoREBT === "otros_usos", "claseCircuitoREBT devuelto correctamente en el resultado");
}

// El mismo circuito pero declarado como vivienda -> límite 3% para TODO, más estricto
const comoVivienda = calcularCircuito(circuitoBase, equipoFuerza, IEC_ES, { tipoInstalacion: "residencial_basico", tieneTransformadorPropio: false });
// Puede seguir siendo ok (con un calibre más grueso) o no — lo que importa es que el %
// usado en el mensaje de error (si falla) sea 3, no 5, y que sea MÁS exigente.
if (!comoVivienda.ok) {
  assert(/≤3%/.test(comoVivienda.error), `Como vivienda, el límite aplicado es 3% (real: '${comoVivienda.error}')`);
}
if (sinTransformador.ok && comoVivienda.ok) {
  // Mismo circuito físico, límite más estricto como vivienda -> la sección elegida nunca puede ser MÁS chica (más A o igual exigencia)
  assert(comoVivienda.areaMm2 >= sinTransformador.areaMm2, `Como vivienda (3%, más estricto) el calibre es igual o más grueso que como otros usos sin transformador (5%) (real: ${comoVivienda.areaMm2} vs ${sinTransformador.areaMm2} mm²)`);
}

// --- 5. Sin contexto (llamada antigua, sin 4to parámetro): sigue tratando todo circuito IEC_ES como "comercial_industrial" + "" vacío -> cae en la rama de tipoInstalacion !== COMERCIAL_INDUSTRIAL (vivienda, 3%) por default ---
const sinContexto = calcularCircuito(circuitoBase, equipoFuerza, IEC_ES);
assert(sinContexto.ok !== undefined, "calcularCircuito sigue funcionando sin el 4to parámetro (compatibilidad hacia atrás)");

// --- 6. evaluarCaidaAcumulada con y sin override ---
const sinOverride = evaluarCaidaAcumulada([5, 4], 230);
assert(sinOverride.limitePct === 5, `Sin override, sigue usando el 5% provisional de NEC (real: ${sinOverride.limitePct}%)`);
const conOverride = evaluarCaidaAcumulada([5, 4], 230, 6.5);
assert(conOverride.limitePct === 6.5, `Con override, usa el límite pasado (real: ${conOverride.limitePct}%)`);
assert(conOverride.excede === (conOverride.totalPct > 6.5), "excede se calcula contra el límite overrideado, no el 5% fijo");

console.log("\nTodas las pruebas completadas.");
