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

// --- 6. Materiales — metros de conductor por calibre (usuario,
//     2026-11-26, "el extra de cruce de pared → conectarlo al cálculo
//     de materiales"). Reusa el mismo circuito "Iluminación" (SIN
//     distancia cargada, default "" — no debe contribuir nada) + un
//     2do circuito CON distancia, + el tablero (longitudAlimentador
//     "15", ya usado arriba). ---
const circuitoConDistancia = App.validacion.formularioACircuito(
  { ...CIRCUITO_VACIO, nombre: "Con distancia", voltaje: "120", fases: "mono", distancia: "20" },
  null
);
const equipoDeCircuitoConDistancia = App.validacion.formularioAEquipo({ ...EQUIPO_VACIO, nombre: "Lámpara 2", valor: "100" }, circuitoConDistancia.id, null);
const circuitosMateriales = [circuito, circuitoConDistancia, circuitoVacio];
const equiposMateriales = [equipo, equipoDeCircuitoConDistancia];
const resultadosMateriales = App.motor.calcularTodos(circuitosMateriales, equiposMateriales, "NEC");

const informeMateriales = App.documento.memoriaTecnica({
  proyecto, normativaActiva: "NEC", circuitos: circuitosMateriales, equipos: equiposMateriales,
  resultados: resultadosMateriales, tableros: [tablero], alimentadores,
  fuentesEnergia: [], transformadores: [], listaIntegridad: [],
});

const filaIluminacion = informeMateriales.circuitos.find((c) => c.nombre === "Iluminación");
assert(filaIluminacion.distanciaM === null, "El circuito 'Iluminación' (distancia '' por default) trae distanciaM: null, no un 0 inventado");
const filaConDistancia = informeMateriales.circuitos.find((c) => c.nombre === "Con distancia");
assert(filaConDistancia.distanciaM === 20, `El circuito 'Con distancia' trae distanciaM = 20 (real: ${filaConDistancia.distanciaM})`);
const filaTableroMateriales = informeMateriales.tableros[0];
assert(filaTableroMateriales.distanciaM === 15, `El tablero trae distanciaM = 15, de longitudAlimentador (real: ${filaTableroMateriales.distanciaM})`);

assert(informeMateriales.materiales.length > 0, "Hay al menos 1 entrada de materiales (con circuitos/tablero OK y con distancia)");
const metrosTotalesReportados = informeMateriales.materiales.reduce((acc, m) => acc + m.metrosTotal, 0);
// "Iluminación" (sin distancia) no contribuye nada — el total debe ser EXACTAMENTE 20 (circuito) + 15 (tablero) = 35,
// nunca más, aunque "Iluminación" también esté OK y calculado.
assert(Math.abs(metrosTotalesReportados - 35) < 1e-9, `El total de metros es 20 (circuito con distancia) + 15 (tablero) = 35, 'Iluminación' no aporta nada (real: ${metrosTotalesReportados})`);

// Mismo calibre en 2 filas distintas (circuito 'Con distancia' + tablero, si comparten calibre) debe sumarse en UNA sola entrada, no 2.
if (filaConDistancia.seccion === filaTableroMateriales.seccion && filaConDistancia.unidadSeccion === filaTableroMateriales.unidadSeccion) {
  assert(
    informeMateriales.materiales.length === 1,
    `Mismo calibre en circuito y tablero: se agrupan en 1 sola entrada (real: ${informeMateriales.materiales.length})`
  );
}

// Sin ningún dato -> lista vacía, no revienta.
const informeSinMateriales = App.documento.memoriaTecnica({
  proyecto, normativaActiva: "NEC", circuitos: [], equipos: [], resultados: [],
  tableros: [], alimentadores: {}, fuentesEnergia: [], transformadores: [], listaIntegridad: [],
});
assert(Array.isArray(informeSinMateriales.materiales) && informeSinMateriales.materiales.length === 0, "Proyecto vacío -> materiales: [] (no revienta)");

console.log("\nTodas las pruebas completadas.");
