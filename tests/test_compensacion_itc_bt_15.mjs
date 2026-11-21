// Compensación ITC-BT-19 §2.2.2 (derivación individual <-> instalación
// interior) — usuario, 2026-11-21, documentos "ITC-BT-15" (límites
// exactos 0,5%/1%/1,5%, cita literal del BOE) + decisión de modelado
// confirmada: la DI es el alimentador del tablero "vivienda" (hijo
// directo de un tablero "edificio" con simultaneidadREBT.activa) hacia
// el edificio. Prueba a nivel ApplicationMediator (app real) que el
// límite ACUMULADO total pasa de 3% (solo interior) a 3%+DI cuando el
// edificio tiene su esquemaContadores asignado, y que SIN ese dato la
// compensación no se aplica (comportamiento de siempre).
import { ApplicationMediator as App } from "../src/core/ApplicationMediator.js";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

function construirEscenario(esquemaContadores) {
  const edificio = App.tablero.crear({
    nombre: "Edificio",
    tableroPadreId: null,
    tensionAlimentacion: 230,
    // LGA (ITC-BT-14) del edificio hacia la acometida — necesaria para
    // que calcularAlimentadorAgregado resuelva este tramo (como
    // cualquier otro tablero), aunque NO cuenta en el total de
    // compensación DI<->interior (ver nota en TableroMediator.js).
    longitudAlimentador: 10,
    materialAlimentador: "cobre",
    fases: "mono",
    simultaneidadREBT: { activa: true, gradoPorDefecto: "basica", esquemaContadores },
  });
  const vivienda = App.tablero.crear({
    nombre: "Vivienda 1",
    tableroPadreId: edificio.id,
    tensionAlimentacion: 230,
    longitudAlimentador: 20,
    materialAlimentador: "cobre",
    fases: "mono",
  });
  const circuito = { id: "c1", nombre: "Tomas", tableroId: vivienda.id, tipo: "mixto", fases: "mono", material: "cobre", voltaje: 230, distancia: 20, temp: 30 };
  const equipos = [{ id: "e1", circuitoId: "c1", nombre: "Carga", modoEntrada: "potencia", valor: 1500, cosPhi: 1, tipoEquipoNEC: "CARGA_GENERAL" }];
  const resultadoCircuito = App.motor.calcularCircuito(circuito, equipos, "IEC_ES");
  return { edificio, vivienda, circuito, equipos, resultadoCircuito };
}

// --- 1. Sin esquemaContadores: compensación NO se aplica, límite = 3% (solo interior, como siempre) ---
const sinEsquema = construirEscenario("");
assert(sinEsquema.resultadoCircuito.ok, `Circuito debe calcular OK (real: ${sinEsquema.resultadoCircuito.error ?? "ok"})`);
const acumuladaSinEsquema = App.tablero.caidaAcumuladaDesdeCircuito(sinEsquema.circuito, {
  tableros: [sinEsquema.edificio, sinEsquema.vivienda],
  circuitos: [sinEsquema.circuito],
  resultados: [sinEsquema.resultadoCircuito],
  normativaId: "IEC_ES",
  resultadoCircuito: sinEsquema.resultadoCircuito,
  equipos: sinEsquema.equipos,
  fuentesEnergia: [],
  transformadores: [],
  tipoInstalacion: "residencial_basico",
});
assert(acumuladaSinEsquema.ok === true, `Sin esquema: debe calcular OK (real: ${acumuladaSinEsquema.ok === false ? acumuladaSinEsquema.motivo : "ok"})`);
if (acumuladaSinEsquema.ok) {
  assert(acumuladaSinEsquema.limitePct === 3, `Sin esquemaContadores, el límite sigue siendo 3% (solo interior, sin compensación) (real: ${acumuladaSinEsquema.limitePct}%)`);
  console.log(`  (referencia: total acumulado = ${acumuladaSinEsquema.totalPct.toFixed(2)}%, excede=${acumuladaSinEsquema.excede})`);
}

// --- 2. Con esquemaContadores "totalmente_concentrados" (DI=1%): límite total = 3%+1%=4% ---
const conEsquema = construirEscenario("totalmente_concentrados");
const acumuladaConEsquema = App.tablero.caidaAcumuladaDesdeCircuito(conEsquema.circuito, {
  tableros: [conEsquema.edificio, conEsquema.vivienda],
  circuitos: [conEsquema.circuito],
  resultados: [conEsquema.resultadoCircuito],
  normativaId: "IEC_ES",
  resultadoCircuito: conEsquema.resultadoCircuito,
  equipos: conEsquema.equipos,
  fuentesEnergia: [],
  transformadores: [],
  tipoInstalacion: "residencial_basico",
});
assert(acumuladaConEsquema.ok === true, `Con esquema "totalmente_concentrados": debe calcular OK (real: ${acumuladaConEsquema.ok === false ? acumuladaConEsquema.motivo : "ok"})`);
if (acumuladaConEsquema.ok) {
  assert(acumuladaConEsquema.limitePct === 4, `Con esquemaContadores "totalmente_concentrados" (DI=1%), el límite total = 3%+1%=4% (real: ${acumuladaConEsquema.limitePct}%)`);
}

// --- 3. Con esquemaContadores "concentrados_mas_de_un_lugar" (DI=0.5%): límite total = 3%+0.5%=3.5% ---
const conEsquema2 = construirEscenario("concentrados_mas_de_un_lugar");
const acumuladaConEsquema2 = App.tablero.caidaAcumuladaDesdeCircuito(conEsquema2.circuito, {
  tableros: [conEsquema2.edificio, conEsquema2.vivienda],
  circuitos: [conEsquema2.circuito],
  resultados: [conEsquema2.resultadoCircuito],
  normativaId: "IEC_ES",
  resultadoCircuito: conEsquema2.resultadoCircuito,
  equipos: conEsquema2.equipos,
  fuentesEnergia: [],
  transformadores: [],
  tipoInstalacion: "residencial_basico",
});
if (acumuladaConEsquema2.ok) {
  assert(acumuladaConEsquema2.limitePct === 3.5, `Con esquemaContadores "concentrados_mas_de_un_lugar" (DI=0,5%), el límite total = 3%+0,5%=3,5% (real: ${acumuladaConEsquema2.limitePct}%)`);
}

// --- 4. NEC: cero cambio (la compensación es exclusiva de IEC_ES, vía el guard limitePctOverride != null) ---
const edificioNEC = App.tablero.crear({ nombre: "Edificio NEC", tableroPadreId: null, tensionAlimentacion: 240, longitudAlimentador: 10, materialAlimentador: "cobre", fases: "mono", simultaneidadREBT: { activa: true, gradoPorDefecto: "basica", esquemaContadores: "totalmente_concentrados" } });
const viviendaNEC = App.tablero.crear({ nombre: "Vivienda NEC", tableroPadreId: edificioNEC.id, tensionAlimentacion: 240, longitudAlimentador: 20, materialAlimentador: "cobre", fases: "mono" });
const circuitoNEC = { id: "c2", nombre: "Tomas NEC", tableroId: viviendaNEC.id, tipo: "mixto", fases: "mono", material: "cobre", voltaje: 240, distancia: 20, temp: 30 };
const equiposNEC = [{ id: "e2", circuitoId: "c2", nombre: "Carga", modoEntrada: "potencia", valor: 1500, cosPhi: 1, tipoEquipoNEC: "CARGA_GENERAL" }];
const resultadoNEC = App.motor.calcularCircuito(circuitoNEC, equiposNEC, "NEC");
if (resultadoNEC.ok) {
  const acumuladaNEC = App.tablero.caidaAcumuladaDesdeCircuito(circuitoNEC, {
    tableros: [edificioNEC, viviendaNEC],
    circuitos: [circuitoNEC],
    resultados: [resultadoNEC],
    normativaId: "NEC",
    resultadoCircuito: resultadoNEC,
    equipos: equiposNEC,
    fuentesEnergia: [],
    transformadores: [],
  });
  if (acumuladaNEC.ok) {
    assert(acumuladaNEC.limitePct === 5, `NEC: sigue en el 5% provisional de siempre, aunque el edificio tenga esquemaContadores (compensación exclusiva de IEC_ES) (real: ${acumuladaNEC.limitePct}%)`);
  }
}

// --- 5. Con compensación, el total EXCLUYE el tramo de LGA del edificio (índice arriba de la DI) — por diseño, NO es
// el mismo total que sin compensación (que sí incluye ese tercer tramo, ver cadenaTramoDI más arriba). El
// 'excede' SÍ cambia de true a false para este mismo circuito físico, que es lo que de verdad importa.
if (acumuladaSinEsquema.ok && acumuladaConEsquema.ok) {
  assert(
    acumuladaConEsquema.totalPct < acumuladaSinEsquema.totalPct,
    `Con compensación, el total (solo circuito+DI, sin el tramo de LGA del edificio) es MENOR que sin compensación (circuito+DI+LGA) — real: ${acumuladaConEsquema.totalPct.toFixed(2)}% vs ${acumuladaSinEsquema.totalPct.toFixed(2)}%`
  );
  assert(acumuladaSinEsquema.excede === true, `Sin compensación (límite 3%, total incluye LGA), el total ${acumuladaSinEsquema.totalPct.toFixed(2)}% SÍ excede`);
  assert(acumuladaConEsquema.excede === false, `Con compensación (límite 4%, total excluye LGA), ya no excede (real: ${acumuladaConEsquema.totalPct.toFixed(2)}%)`);
}

console.log("\nTodas las pruebas completadas.");
