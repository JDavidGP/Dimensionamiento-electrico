import { ApplicationMediator as App } from "../src/core/ApplicationMediator.ts";

let fallos = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FALLÓ:", msg); fallos++; }
  else console.log("OK:", msg);
}

const NORM = "NEC";

function circuito(nombre, { voltaje, fases, lineas, tableroId, potenciaW }) {
  const base = {
    nombre, tipo: "dedicado", fases, voltaje: String(voltaje), voltajeManual: true,
    material: "cobre", distancia: "5", temp: "30", factorSimultaneidadManual: "",
    tableroId, lineas,
  };
  const c = App.validacion.formularioACircuito(base);
  const equipo = App.validacion.formularioAEquipo(
    { nombre: "carga", cantidad: "1", modoEntrada: "potencia", valor: String(potenciaW), cosPhi: "1.0", tipoEquipoNEC: "CARGA_GENERAL", esCargaContinua: false, corrienteRotorBloqueado: "" },
    c.id
  );
  return { circuito: c, equipo };
}

// Tablero tri con 3 circuitos mono desbalanceados: L1=10A, L2=10A, L3=~30A
const t1 = App.tablero.crear({ nombre: "Principal", tensionAlimentacion: "120", fases: "tri", tableroPadreId: null, longitudAlimentador: "10", materialAlimentador: "cobre" });

const c1 = circuito("Luces", { voltaje: 120, fases: "mono", lineas: ["L1"], tableroId: t1.id, potenciaW: 1200 }); // ~10A
const c2 = circuito("Tomas", { voltaje: 120, fases: "mono", lineas: ["L2"], tableroId: t1.id, potenciaW: 1200 }); // ~10A
const c3 = circuito("Aire", { voltaje: 120, fases: "mono", lineas: ["L3"], tableroId: t1.id, potenciaW: 3600 }); // ~30A

const circuitos = [c1.circuito, c2.circuito, c3.circuito];
const equipos = [c1.equipo, c2.equipo, c3.equipo];
const tableros = [t1];

const resultados = App.motor.calcularTodos(circuitos, equipos, NORM);
assert(resultados.every((r) => r.ok), "los 3 circuitos calculan OK (" + resultados.map(r=>r.ok).join(",") + ")");

const balance = App.tablero.balanceFasesDeTablero(t1.id, { tableros, circuitos, resultados, normativaId: NORM });
assert(balance.aplica === true && balance.ok === true, "balance aplica y calcula OK");
assert(balance.excede === true, `balance excede el umbral por defecto (10%) — obtenido ${balance.porcentajeDesbalance?.toFixed(2)}%`);
assert(Math.abs(balance.porLinea.L3 - 30) < 1, `L3 ~30A (obtenido ${balance.porLinea.L3?.toFixed(2)})`);
assert(Math.abs(balance.porLinea.L1 - 10) < 1, `L1 ~10A (obtenido ${balance.porLinea.L1?.toFixed(2)})`);

// contribuyentesPorLinea: L3 debe tener exactamente a "Aire"
const contribL3 = balance.contribuyentesPorLinea.L3;
assert(Array.isArray(contribL3) && contribL3.length === 1 && contribL3[0].nombre === "Aire", "contribuyentesPorLinea.L3 identifica a 'Aire' como único aportante");
assert(contribL3[0].tipo === "circuito", "el contribuyente está marcado tipo 'circuito'");

// umbralPct configurable explícito: con 200% (por encima del 120% real) ya no debería exceder
const balanceUmbralAlto = App.tablero.balanceFasesDeTablero(t1.id, { tableros, circuitos, resultados, normativaId: NORM, umbralPct: 200 });
assert(balanceUmbralAlto.excede === false, `con umbralPct=200 explícito, ya no excede (desbalance real ${balance.porcentajeDesbalance?.toFixed(2)}%)`);
assert(balanceUmbralAlto.advertencias.length > 0, "umbralPct=200 (por encima del 10% recomendado) genera advertencia seria");

// noDeterminado: un circuito sin líneas asignadas
const c4 = circuito("SinLinea", { voltaje: 120, fases: "mono", lineas: [], tableroId: t1.id, potenciaW: 500 });
const circuitos2 = [...circuitos, c4.circuito];
const equipos2 = [...equipos, c4.equipo];
const resultados2 = App.motor.calcularTodos(circuitos2, equipos2, NORM);
const balance2 = App.tablero.balanceFasesDeTablero(t1.id, { tableros, circuitos: circuitos2, resultados: resultados2, normativaId: NORM });
assert(balance2.noDeterminado === true && /SinLinea/.test(balance2.motivo), "circuito sin líneas -> noDeterminado con motivo específico");

// tablero mono -> aplica:false
const t2 = App.tablero.crear({ nombre: "Mono", tensionAlimentacion: "120", fases: "mono", tableroPadreId: null, longitudAlimentador: "5", materialAlimentador: "cobre" });
const balanceMono = App.tablero.balanceFasesDeTablero(t2.id, { tableros: [...tableros, t2], circuitos, resultados, normativaId: NORM });
assert(balanceMono.aplica === false, "tablero mono -> aplica:false");

console.log(fallos === 0 ? "\nTODOS LOS CHECKS PASARON" : `\n${fallos} CHECK(S) FALLARON`);
process.exit(fallos === 0 ? 0 : 1);
