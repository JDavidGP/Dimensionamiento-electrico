// Cortocircuito MÁS ALLÁ de los bornes del transformador — usuario,
// 2026-11-21, documento "tabla completa X/R aceite/seco": cierra
// parcialmente el "FUERA DE ALCANCE" (cortocircuito solo en bornes)
// sumando la impedancia de cada alimentador de la cadena hasta el
// tablero objetivo. Prueba TableroMediator.cortocircuitoDesdeTablero a
// nivel ApplicationMediator (app real, no solo funciones puras).
import { ApplicationMediator as App } from "../src/core/ApplicationMediator.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

// --- Escenario: transformador 500kVA/400V/tri/%Z=4%/aceite -> tablero TD1 (20m, cobre, tri) con un circuito real ---
const transformador = App.origen.crearTransformador({
  nombre: "TR-500",
  fases: "tri",
  tensionPrimariaV: "13800",
  tensionSecundariaV: "400",
  capacidadKVA: "500",
  impedanciaPct: "4",
  tipoRefrigeracion: "aceite",
});

const tablero = App.tablero.crear({
  nombre: "TD1",
  tableroPadreId: transformador.id,
  tensionAlimentacion: 400,
  longitudAlimentador: 20,
  materialAlimentador: "cobre",
  fases: "tri",
});

const circuito = { id: "c1", nombre: "Carga TD1", tableroId: tablero.id, tipo: "mixto", fases: "tri", material: "cobre", voltaje: 400, distancia: 15, temp: 30 };
const equipos = [{ id: "e1", circuitoId: "c1", nombre: "Carga", modoEntrada: "potencia", valor: 5000, cosPhi: 0.9, tipoEquipoNEC: "CARGA_GENERAL" }];
const resultadoCircuito = App.motor.calcularCircuito(circuito, equipos, "IEC_ES");
assert(resultadoCircuito.ok, `Circuito de prueba debe calcular OK (real: ${resultadoCircuito.error ?? "ok"})`);

const params = { tableros: [tablero], circuitos: [circuito], resultados: [resultadoCircuito], normativaId: "IEC_ES", fuentesEnergia: [], transformadores: [transformador] };

// --- 1. Caso completo: aplica, ok, xrDisponible (tipoRefrigeracion+capacidad en rango de la tabla) ---
const resultado = App.tablero.cortocircuitoDesdeTablero(tablero.id, params);
assert(resultado.aplica === true, "cortocircuitoDesdeTablero: aplica cuando la cadena termina en un transformador propio");
assert(resultado.ok === true, `cortocircuitoDesdeTablero: ok (real: ${resultado.ok === false ? resultado.motivo : "ok"})`);
if (resultado.ok) {
  assert(resultado.xrDisponible === true, "xrDisponible: true (500kVA aceite está en la tabla citada, exacto)");
  assert(resultado.xrInterpolado === false, "xrInterpolado: false (500kVA es un punto EXACTO de la tabla)");
  assert(resultado.cantidadTramos === 1, "cantidadTramos = 1 (un solo tablero en la cadena)");
  assert(resultado.iccA > 0 && Number.isFinite(resultado.iccA), `Icc > 0 y finito (real: ${resultado.iccA})`);

  // Comparación física: Icc con conductor en serie debe ser MENOR que Icc en los bornes del transformador solo.
  const impedanciaBornes = App.origen.calcularImpedanciaTransformadorOhm({ capacidadKVA: 500, tensionSecundariaV: 400, impedanciaPct: 4, xr: 5.2 });
  const iccBornes = App.origen.calcularCortocircuitoTrifasico(400, impedanciaBornes.impedancia, 0, 0).iccA;
  assert(resultado.iccA < iccBornes, `Icc en TD1 (con 20m de conductor) < Icc en los bornes del transformador (real: ${resultado.iccA.toFixed(0)}A vs ${iccBornes.toFixed(0)}A)`);
}

// --- 2. Tablero que NO cuelga de un transformador (acometida) -> aplica:false, no inventa ---
const tableroSinTrafo = App.tablero.crear({ nombre: "TD2", tableroPadreId: null, tensionAlimentacion: 400, longitudAlimentador: 10, materialAlimentador: "cobre", fases: "tri" });
const resultadoSinTrafo = App.tablero.cortocircuitoDesdeTablero(tableroSinTrafo.id, { tableros: [tableroSinTrafo], transformadores: [transformador] });
assert(resultadoSinTrafo.aplica === false, "Tablero cuya cadena termina en acometida (sin transformador) -> aplica:false");

// --- 3. Transformador sin %Z -> aplica:true, ok:false, motivo explícito ---
const transformadorSinZ = App.origen.crearTransformador({ nombre: "TR-sinZ", fases: "tri", tensionSecundariaV: "400", capacidadKVA: "500" });
const tableroConTrafoSinZ = App.tablero.crear({ nombre: "TD3", tableroPadreId: transformadorSinZ.id, tensionAlimentacion: 400, longitudAlimentador: 10, materialAlimentador: "cobre", fases: "tri" });
const resultadoSinZ = App.tablero.cortocircuitoDesdeTablero(tableroConTrafoSinZ.id, {
  tableros: [tableroConTrafoSinZ],
  transformadores: [transformadorSinZ],
  fuentesEnergia: [],
});
assert(resultadoSinZ.aplica === true && resultadoSinZ.ok === false, `Transformador sin %Z -> aplica:true, ok:false (real: ${JSON.stringify(resultadoSinZ)})`);

// --- 4. Sin tipoRefrigeracion -> igual calcula (reparto degenerado r=0/x=Z), pero avisa xrDisponible:false ---
const transformadorSinTipo = App.origen.crearTransformador({ nombre: "TR-sinTipo", fases: "tri", tensionSecundariaV: "400", capacidadKVA: "500", impedanciaPct: "4" });
const tableroSinTipo = App.tablero.crear({ nombre: "TD4", tableroPadreId: transformadorSinTipo.id, tensionAlimentacion: 400, longitudAlimentador: 20, materialAlimentador: "cobre", fases: "tri" });
const circuito4 = { ...circuito, id: "c4", tableroId: tableroSinTipo.id };
const resultadoCircuito4 = App.motor.calcularCircuito(circuito4, equipos.map((e) => ({ ...e, circuitoId: "c4" })), "IEC_ES");
const resultadoSinTipo = App.tablero.cortocircuitoDesdeTablero(tableroSinTipo.id, {
  tableros: [tableroSinTipo],
  circuitos: [circuito4],
  resultados: [resultadoCircuito4],
  normativaId: "IEC_ES",
  transformadores: [transformadorSinTipo],
  fuentesEnergia: [],
});
assert(resultadoSinTipo.aplica === true && resultadoSinTipo.ok === true, "Sin tipoRefrigeracion, igual calcula (reparto degenerado) en vez de bloquear");
if (resultadoSinTipo.ok) {
  assert(resultadoSinTipo.xrDisponible === false, "xrDisponible:false avisa que se usó el reparto degenerado (sin X/R real)");
}

// --- 5. Subtablero (2 tramos en la cadena): cantidadTramos=2, Icc menor que con 1 solo tramo ---
const subtablero = App.tablero.crear({ nombre: "TD1-sub", tableroPadreId: tablero.id, tensionAlimentacion: 400, longitudAlimentador: 15, materialAlimentador: "cobre", fases: "tri" });
const circuitoSub = { ...circuito, id: "c5", tableroId: subtablero.id };
const resultadoCircuitoSub = App.motor.calcularCircuito(circuitoSub, equipos.map((e) => ({ ...e, circuitoId: "c5" })), "IEC_ES");
const resultadoSubtablero = App.tablero.cortocircuitoDesdeTablero(subtablero.id, {
  tableros: [tablero, subtablero],
  circuitos: [circuito, circuitoSub],
  resultados: [resultadoCircuito, resultadoCircuitoSub],
  normativaId: "IEC_ES",
  transformadores: [transformador],
  fuentesEnergia: [],
});
assert(resultadoSubtablero.aplica === true && resultadoSubtablero.ok === true, `Subtablero: debe calcular OK (real: ${resultadoSubtablero.ok === false ? resultadoSubtablero.motivo : "ok"})`);
if (resultadoSubtablero.ok && resultado.ok) {
  assert(resultadoSubtablero.cantidadTramos === 2, `Subtablero: cantidadTramos=2 (su propio tramo + el de TD1) (real: ${resultadoSubtablero.cantidadTramos})`);
  assert(resultadoSubtablero.iccA < resultado.iccA, `Icc en el subtablero (2 tramos) < Icc en TD1 (1 tramo) — más conductor en serie, menos corriente de falla (real: ${resultadoSubtablero.iccA.toFixed(0)}A vs ${resultado.iccA.toFixed(0)}A)`);
}

console.log("\nTodas las pruebas completadas.");
