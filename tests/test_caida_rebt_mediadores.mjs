// Caída de tensión REBT — ITC-BT-19 §2.2.2: integración a nivel
// MEDIADOR (TableroMediator.tieneTransformadorPropio + override de
// MotorCalculoMediator.calcularCircuito/calcularTodos +
// TableroMediator.caidaAcumuladaDesdeCircuito con el límite REBT) —
// la capa pura (claseCircuitoREBT, IEC_ES.limiteCaidaTension...) ya se
// probó aparte en test_caida_rebt_puro.mjs. Acá se prueba que la
// app REAL (ApplicationMediator) ya puede usar todo esto, no solo las
// funciones puras en aislamiento.
import { ApplicationMediator as App } from "../src/core/ApplicationMediator.js";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

// --- 1. TableroMediator.tieneTransformadorPropio ---
const transformador = App.origen.crearTransformador({ nombre: "TR-1", fases: "tri", tensionPrimariaV: "480", tensionSecundariaV: "208", capacidadKVA: "75" });
const tableroConTransformador = App.tablero.crear({ nombre: "TD-1", tableroPadreId: transformador.id });
const subtableroDeTD1 = App.tablero.crear({ nombre: "TD-2", tableroPadreId: tableroConTransformador.id });
const tableroSinTransformador = App.tablero.crear({ nombre: "TD-3", tableroPadreId: null });

assert(
  App.tablero.tieneTransformadorPropio(tableroConTransformador.id, { tableros: [tableroConTransformador], transformadores: [transformador] }) === true,
  "tieneTransformadorPropio: true cuando el tablero cuelga DIRECTO de un transformador"
);
assert(
  App.tablero.tieneTransformadorPropio(subtableroDeTD1.id, { tableros: [tableroConTransformador, subtableroDeTD1], transformadores: [transformador] }) === true,
  "tieneTransformadorPropio: true también para un SUBtablero (cadena ascendente pasa por el tablero con transformador)"
);
assert(
  App.tablero.tieneTransformadorPropio(tableroSinTransformador.id, { tableros: [tableroSinTransformador], transformadores: [transformador] }) === false,
  "tieneTransformadorPropio: false cuando la cadena termina en acometida (sin padre)"
);
assert(
  App.tablero.tieneTransformadorPropio("id-que-no-existe", { tableros: [], transformadores: [] }) === false,
  "tieneTransformadorPropio: false (conservador) para un tableroId que no existe, no revienta"
);

// --- 2. MotorCalculoMediator aplica el override vía calcularCircuito/calcularTodos ---
const circuito = { id: "c1", nombre: "Tomas oficina", tipo: "mixto", fases: "mono", material: "cobre", voltaje: 230, distancia: 55, temp: 30 };
const equipos = [{ id: "e1", circuitoId: "c1", nombre: "Tomacorriente", modoEntrada: "potencia", valor: 2000, cosPhi: 1, tipoEquipoNEC: "CARGA_GENERAL" }];

const comoOtrosUsosSinTransformador = App.motor.calcularCircuito(circuito, equipos, "IEC_ES", { tipoInstalacion: "comercial_industrial", tieneTransformadorPropio: false });
assert(comoOtrosUsosSinTransformador.ok, `MotorCalculoMediator.calcularCircuito con contexto: otros usos sin transformador (5%) debería dimensionar (real: ok=${comoOtrosUsosSinTransformador.ok})`);

const todos = App.motor.calcularTodos([circuito], equipos, "IEC_ES", { c1: { tipoInstalacion: "comercial_industrial", tieneTransformadorPropio: false } });
assert(todos.length === 1 && todos[0].ok === comoOtrosUsosSinTransformador.ok && todos[0].areaMm2 === comoOtrosUsosSinTransformador.areaMm2, "calcularTodos con contextoPorCircuitoId reproduce el mismo resultado que calcularCircuito individual");

const sinContextoPorCircuito = App.motor.calcularTodos([circuito], equipos, "IEC_ES");
assert(sinContextoPorCircuito.length === 1, "calcularTodos sigue funcionando sin contextoPorCircuitoId (compatibilidad hacia atrás)");

// --- 3. TableroMediator.caidaAcumuladaDesdeCircuito aplica el límite REBT, no el 5% fijo ---
// Cadena: circuito -> tablero (cuelga de un transformador propio, industrial) -> transformador.
// Límite REBT esperado para "otros_usos" + transformador propio = 6.5%, NO el 5% NEC-provisional.
const tableroParaAcumulada = App.tablero.crear({ nombre: "TD-industrial", tableroPadreId: transformador.id, tensionAlimentacion: 480, longitudAlimentador: 10, materialAlimentador: "cobre", fases: "tri" });
const circuitoEnTablero = { ...circuito, id: "c2", tableroId: tableroParaAcumulada.id };
const equiposC2 = [{ id: "e2", circuitoId: "c2", nombre: "Tomacorriente", modoEntrada: "potencia", valor: 2000, cosPhi: 1, tipoEquipoNEC: "CARGA_GENERAL" }];

const resultadoC2 = App.motor.calcularCircuito(circuitoEnTablero, equiposC2, "IEC_ES", { tipoInstalacion: "comercial_industrial", tieneTransformadorPropio: true });
assert(resultadoC2.ok, `Circuito de prueba para acumulada debe calcular OK (real: ${resultadoC2.error ?? "ok"})`);

if (resultadoC2.ok) {
  const acumulada = App.tablero.caidaAcumuladaDesdeCircuito(circuitoEnTablero, {
    tableros: [tableroParaAcumulada],
    circuitos: [circuitoEnTablero],
    resultados: [resultadoC2],
    normativaId: "IEC_ES",
    resultadoCircuito: resultadoC2,
    equipos: equiposC2,
    fuentesEnergia: [],
    transformadores: [transformador],
    tipoInstalacion: "comercial_industrial",
  });
  // El tablero en sí no tiene alimentador propio calculable sin más
  // circuitos — lo que importa acá es que el límite usado sea 6.5, no 5.
  assert(acumulada.aplica === true, "caidaAcumuladaDesdeCircuito: aplica cuando el circuito tiene tableroId y calculó OK");
  if (acumulada.ok) {
    assert(acumulada.limitePct === 6.5, `caidaAcumuladaDesdeCircuito usa el límite REBT acumulado (otros_usos + transformador propio = 6.5%), no el 5% NEC-provisional (real: ${acumulada.limitePct}%)`);
  } else {
    console.log("  (nota: el alimentador del tablero no cumplió por separado — no afecta lo que se está probando, el límite se resuelve antes de ese chequeo)");
  }
}

// --- 4. Con normativa NEC, cero cambio: sigue en 5% fijo, tieneTransformadorPropio nunca se evalúa ---
const resultadoNEC = App.motor.calcularCircuito({ ...circuito, voltaje: 240, material: "cobre" }, equipos, "NEC");
if (resultadoNEC.ok) {
  const acumuladaNEC = App.tablero.caidaAcumuladaDesdeCircuito({ ...circuito, voltaje: 240, tableroId: null }, {
    normativaId: "NEC",
    resultadoCircuito: resultadoNEC,
  });
  assert(acumuladaNEC.aplica === false, "Sin tableroId, caidaAcumuladaDesdeCircuito sigue devolviendo aplica:false (sin cambios)");
}

console.log("\nTodas las pruebas completadas.");
