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
const proyecto = { id: "p1", nombre: "Casa de prueba" };

// --- Un circuito con un equipo, calculado ---
const circuito = App.validacion.formularioACircuito({ ...CIRCUITO_VACIO, nombre: "Iluminación", voltaje: "120", fases: "mono" }, null);
const equipo = App.validacion.formularioAEquipo({ ...EQUIPO_VACIO, nombre: "Lámpara", valor: "100" }, circuito.id, null);
const circuitos = [circuito];
const equipos = [equipo];
const resultados = App.motor.calcularTodos(circuitos, equipos, "NEC");

// --- Un circuito SIN equipos (no calcula) ---
const circuitoVacio = App.validacion.formularioACircuito({ ...CIRCUITO_VACIO, nombre: "Sin equipos", voltaje: "120", fases: "mono" }, null);
const todosCircuitos = [circuito, circuitoVacio];
const todosResultados = App.motor.calcularTodos(todosCircuitos, equipos, "NEC");

// --- Un tablero ---
const tablero = App.tablero.crear({ nombre: "TD-1", tensionAlimentacion: "120", fases: "mono", longitudAlimentador: "15" });
const circuitoAsignado = App.tablero.asignar(circuito, tablero.id);
const circuitosConTablero = [circuitoAsignado, circuitoVacio];
const resultadosConTablero = App.motor.calcularTodos(circuitosConTablero, equipos, "NEC");
const alimentadores = { [tablero.id]: App.tablero.calcularAlimentadorAgregado(tablero.id, { tableros: [tablero], circuitos: circuitosConTablero, resultados: resultadosConTablero, normativaId: "NEC" }) };

// --- 1. memoriaTecnica() básico ---
const informe = App.documento.memoriaTecnica({
  proyecto,
  normativaActiva: "NEC",
  tipoInstalacion: { id: "residencial_basico", label: "Residencial básico" },
  circuitos: todosCircuitos,
  equipos,
  resultados: todosResultados,
  tableros: [],
  alimentadores: {},
  fuentesEnergia: [],
  transformadores: [],
  listaIntegridad: [],
});

assert(informe.proyecto.nombre === "Casa de prueba", "El informe trae el nombre del proyecto");
assert(informe.normativa.id === "NEC" && informe.normativa.nombre?.length > 0, "La normativa viene resuelta con nombre");
assert(informe.circuitos.length === 2, "Trae los 2 circuitos (uno calculado, uno sin equipos)");
const filaOk = informe.circuitos.find((c) => c.nombre === "Iluminación");
assert(filaOk?.ok === true && filaOk.potenciaW > 0 && filaOk.corrienteA > 0 && filaOk.breaker > 0, "El circuito con equipo trae su resultado real (potencia/corriente/breaker)");
const filaRota = informe.circuitos.find((c) => c.nombre === "Sin equipos");
assert(filaRota?.ok === false && filaRota.error?.length > 0, "El circuito sin equipos trae ok:false con el motivo, no un valor inventado");
assert(informe.totales.circuitosOk === 1 && informe.totales.circuitosTotal === 2, "Totales cuentan bien (1 ok de 2 totales)");
assert(informe.totales.potenciaTotalW === filaOk.potenciaW, "potenciaTotalW del informe = la del único circuito OK (el roto no suma)");

// --- 2. Con tablero y origen resuelto ---
const informeTablero = App.documento.memoriaTecnica({
  proyecto, normativaActiva: "NEC", circuitos: circuitosConTablero, equipos,
  resultados: resultadosConTablero, tableros: [tablero], alimentadores,
  fuentesEnergia: [], transformadores: [], listaIntegridad: [],
});
assert(informeTablero.tableros.length === 1, "Trae el tablero");
const filaTablero = informeTablero.tableros[0];
assert(filaTablero.origen === "Red eléctrica local (acometida / poste)", `Origen resuelto correctamente (sin padre -> acometida) (real: '${filaTablero.origen}')`);
assert(filaTablero.ok === true && filaTablero.breaker > 0, "El alimentador del tablero trae su resultado real");

// --- 3. Origen con fuente de energía ---
const generador = App.origen.crearFuente({ nombre: "Gen-Diesel", tipo: "generador" });
const tableroConFuente = App.tablero.crear({ nombre: "TD-2", tensionAlimentacion: "120", fases: "mono", tableroPadreId: generador.id });
const informeFuente = App.documento.memoriaTecnica({
  proyecto, normativaActiva: "NEC", circuitos: [], equipos: [], resultados: [],
  tableros: [tableroConFuente], alimentadores: {}, fuentesEnergia: [generador], transformadores: [], listaIntegridad: [],
});
assert(informeFuente.tableros[0].origen === "Gen-Diesel (Generador)", `Origen resuelto como fuente de energía (obtuvo: ${informeFuente.tableros[0].origen})`);

// --- 4. Origen roto (referencia inexistente) ---
const tableroRoto = App.tablero.crear({ nombre: "TD-3", tensionAlimentacion: "120", fases: "mono", tableroPadreId: "id-que-no-existe" });
const informeRoto = App.documento.memoriaTecnica({
  proyecto, normativaActiva: "NEC", circuitos: [], equipos: [], resultados: [],
  tableros: [tableroRoto], alimentadores: {}, fuentesEnergia: [], transformadores: [], listaIntegridad: [],
});
assert(informeRoto.tableros[0].origen.includes("desconocido"), "Origen roto se reporta como tal, no se inventa un nombre");

// --- 5. Integridad: entradas con problemas se listan, resumen cuenta bien ---
const listaIntegridadConProblemas = App.validacion.listaIntegridad(proyecto, [], [], [tableroRoto], [], [], []);
const informeIntegridad = App.documento.memoriaTecnica({
  proyecto, normativaActiva: "NEC", circuitos: [], equipos: [], resultados: [],
  tableros: [tableroRoto], alimentadores: {}, fuentesEnergia: [], transformadores: [],
  listaIntegridad: listaIntegridadConProblemas,
});
assert(informeIntegridad.integridad.entradas.length > 0, "Las entradas con problemas de integridad aparecen en el informe");
assert(informeIntegridad.integridad.resumen.error >= 1, "El resumen de integridad cuenta el error (padre inexistente)");

console.log("\nTodas las pruebas completadas.");
