// Prueba del respaldo nuevo (2026-11-20): si un tablero NO declaró su
// propia distancia/material de alimentador, y su origen es una fuente
// de energía que SÍ los tiene, TableroMediator.calcularAlimentadorAgregado
// debe usarlos como respaldo — sin que el tablero necesite repetir el
// dato (ver conRespaldoDeFuente en TableroMediator.js).
import { ApplicationMediator as App } from "../src/core/ApplicationMediator.js";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

const { CIRCUITO_VACIO, EQUIPO_VACIO } = App.data.tablas.plantillas();

const circuito = App.validacion.formularioACircuito({ ...CIRCUITO_VACIO, nombre: "Iluminación", voltaje: "120", fases: "mono" }, null);
const equipo = App.validacion.formularioAEquipo({ ...EQUIPO_VACIO, nombre: "Lámpara", valor: "500" }, circuito.id, null);
const circuitos = [circuito];
const equipos = [equipo];
const resultados = App.motor.calcularTodos(circuitos, equipos, "NEC");

const fuente = App.origen.crearFuente({ nombre: "Red local", tipo: "red_local", rol: "principal", distanciaM: "20", materialConductor: "cobre" });

// --- 1. Tablero SIN su propia distancia, origen = la fuente ---
const tableroSinPropia = App.tablero.crear({ nombre: "TD-1", tensionAlimentacion: "120", fases: "mono", tableroPadreId: fuente.id });
const circuitoAsignadoA = App.tablero.asignar(circuito, tableroSinPropia.id);

const alimSinPropia = App.tablero.calcularAlimentadorAgregado(tableroSinPropia.id, {
  tableros: [tableroSinPropia],
  circuitos: [circuitoAsignadoA],
  resultados: App.motor.calcularTodos([circuitoAsignadoA], equipos, "NEC"),
  normativaId: "NEC",
  fuentesEnergia: [fuente],
});

assert(alimSinPropia.ok === true, `El alimentador calcula OK usando la distancia/material de la fuente como respaldo (real: ${JSON.stringify(alimSinPropia)})`);

// --- 2. Mismo tablero, pero CON su propia distancia (debe pisar el respaldo) ---
const tableroConPropia = App.tablero.crear({
  nombre: "TD-2",
  tensionAlimentacion: "120",
  fases: "mono",
  tableroPadreId: fuente.id,
  longitudAlimentador: "80",
  materialAlimentador: "aluminio",
});
const circuitoAsignadoB = App.tablero.asignar(circuito, tableroConPropia.id);

const alimConPropia = App.tablero.calcularAlimentadorAgregado(tableroConPropia.id, {
  tableros: [tableroConPropia],
  circuitos: [circuitoAsignadoB],
  resultados: App.motor.calcularTodos([circuitoAsignadoB], equipos, "NEC"),
  normativaId: "NEC",
  fuentesEnergia: [fuente],
});

assert(alimConPropia.ok !== undefined, "El tablero con distancia propia también calcula (puede dar ok:false si 80m de aluminio no cumple, pero no explota)");
assert(
  JSON.stringify(alimConPropia) !== JSON.stringify(alimSinPropia),
  "El resultado con distancia propia (80m aluminio) es distinto al del respaldo (20m cobre) — la propia manda, no la de la fuente"
);

// --- 3. Sin fuentesEnergia en el override (default a DataProvider, lista vacía): no explota, simplemente no hay respaldo ---
const alimSinOverride = App.tablero.calcularAlimentadorAgregado(tableroSinPropia.id, {
  tableros: [tableroSinPropia],
  circuitos: [circuitoAsignadoA],
  resultados: App.motor.calcularTodos([circuitoAsignadoA], equipos, "NEC"),
  normativaId: "NEC",
  // fuentesEnergia omitido a propósito
});
assert(alimSinOverride.ok === false && alimSinOverride.pendiente === true, "Sin pasar fuentesEnergia (ni snapshot), vuelve al comportamiento de siempre: pendiente por falta de longitud, no inventa nada");

console.log("\nTodas las pruebas completadas.");
