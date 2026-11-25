// Altura de instalación del equipo sumada al metraje real del
// conductor — usuario, 2026-11-25: "hay que tomar en cuenta la altura
// donde se instala un interruptor [o] tomacorriente... y el ambiente
// donde se localiza". Prueba la capa PURA: calcularExtraAlturaInstalacion
// y calcularLongitudEsperadaRuta (modules/plano/alturaInstalacion.ts).
import { calcularExtraAlturaInstalacion, calcularLongitudEsperadaRuta } from "../src/modules/plano/index.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

// Geometría común: ruta recta de (0,0) a (5,0), terminando justo donde
// hay un marcador de equipo en (5,0).
const nodos = [
  { id: "n1", punto: { x: 0, y: 0 } },
  { id: "n2", punto: { x: 5, y: 0 } },
];
const ruta = { id: "r1", nodoIds: ["n1", "n2"], nombre: "Ruta de prueba", longitudM: 5, entidadId: null, entidadTipo: null };

// --- 1. Sin marcador de equipo en el extremo -> no aplica ---
const sinMarcador = calcularExtraAlturaInstalacion(ruta, nodos, [], [], [], null);
assert(sinMarcador.aplica === false && sinMarcador.extraM === 0, "Sin marcador de equipo en el extremo de la ruta, no aplica ningún extra");

// --- 2. Marcador de equipo SIN entidadId (sin vincular) -> no aplica ---
const marcadoresSinVincular = [{ id: "m1", punto: { x: 5, y: 0 }, tipo: "contacto", entidadId: null }];
const sinVincular = calcularExtraAlturaInstalacion(ruta, nodos, marcadoresSinVincular, [], [], null);
assert(sinVincular.aplica === false, "Marcador sin vincular a ningún equipo real, no aplica ningún extra");

// --- 3. Equipo vinculado SIN alturaInstalacionM cargada -> no aplica (comportamiento de siempre, sin cambios) ---
const marcadores = [{ id: "m1", punto: { x: 5, y: 0 }, tipo: "contacto", entidadId: "e1" }];
const equipoSinAltura = [{ id: "e1", alturaInstalacionM: null }];
const sinAltura = calcularExtraAlturaInstalacion(ruta, nodos, marcadores, equipoSinAltura, [], null);
assert(sinAltura.aplica === false && sinAltura.extraM === 0, "Equipo vinculado pero sin altura de instalación cargada, no suma ningún extra");

// --- 4. Referencia "piso": el extra es directamente la altura de instalación ---
const equipoPiso = [{ id: "e1", alturaInstalacionM: 0.4, referenciaAltura: "piso" }];
const extraPiso = calcularExtraAlturaInstalacion(ruta, nodos, marcadores, equipoPiso, [], null);
assert(extraPiso.aplica === true && Math.abs(extraPiso.extraM - 0.4) < 1e-9, `Referencia 'piso': extra = altura de instalación exacta (real: ${extraPiso.extraM})`);

// --- 5. Referencia "techo" (default) SIN altura de techo disponible (ni en el ambiente ni general) -> no se inventa, extra=0 con motivo ---
const equipoTecho = [{ id: "e1", alturaInstalacionM: 1.3, referenciaAltura: "techo" }];
const sinTecho = calcularExtraAlturaInstalacion(ruta, nodos, marcadores, equipoTecho, [], null);
assert(sinTecho.aplica === true && sinTecho.extraM === 0 && !!sinTecho.motivo, `Referencia 'techo' sin dato de altura de techo -> no inventa, extra=0 con motivo (real: extraM=${sinTecho.extraM}, motivo="${sinTecho.motivo}")`);

// --- 6. Referencia "techo" con altura GENERAL del plano (sin ambiente) ---
const conTechoGeneral = calcularExtraAlturaInstalacion(ruta, nodos, marcadores, equipoTecho, [], 2.5);
assert(Math.abs(conTechoGeneral.extraM - (2.5 - 1.3)) < 1e-9, `Referencia 'techo' con altura general del plano: extra = techo - instalación (real: ${conTechoGeneral.extraM}, esperado: ${2.5 - 1.3})`);

// --- 7. Referencia "techo" con altura PROPIA del ambiente (prioridad sobre la general) ---
const habitacionConAltura = [{ id: "h1", nodoIds: ["ha", "hb", "hc", "hd"], nombre: "Cuarto", areaM2: 1, perimetroM: 1, alturaM: 3.0, exterior: false }];
const nodosHabitacion = [
  ...nodos,
  { id: "ha", punto: { x: 4, y: -1 } },
  { id: "hb", punto: { x: 6, y: -1 } },
  { id: "hc", punto: { x: 6, y: 1 } },
  { id: "hd", punto: { x: 4, y: 1 } },
];
const conAmbiente = calcularExtraAlturaInstalacion(ruta, nodosHabitacion, marcadores, equipoTecho, habitacionConAltura, 2.5);
assert(Math.abs(conAmbiente.extraM - (3.0 - 1.3)) < 1e-9, `La altura de techo DEL AMBIENTE (3.0m) gana sobre la general del plano (2.5m) (real: ${conAmbiente.extraM})`);
assert(conAmbiente.alturaTechoUsadaM === 3.0, "alturaTechoUsadaM refleja cuál de las dos se usó (la del ambiente)");

// --- 8. Dato físicamente imposible (instalación por encima del techo) -> no se inventa un extra negativo ---
const equipoImposible = [{ id: "e1", alturaInstalacionM: 3.5, referenciaAltura: "techo" }];
const imposible = calcularExtraAlturaInstalacion(ruta, nodosHabitacion, marcadores, equipoImposible, habitacionConAltura, null);
assert(imposible.extraM === 0 && !!imposible.motivo, `Altura de instalación (3.5m) por encima del techo (3.0m) -> extra=0 con motivo, nunca negativo (real: extraM=${imposible.extraM})`);

// --- 9. calcularLongitudEsperadaRuta: combina cruces de pared + altura en un solo total ---
const segmentosPared = []; // sin paredes en el camino -> extraTotalM=0
const esperado = calcularLongitudEsperadaRuta(ruta, nodosHabitacion, segmentosPared, marcadores, equipoPiso, [], null);
assert(Math.abs(esperado.longitudTotalM - 5) < 1e-9, "longitudTotalM (sin paredes) sigue siendo solo el trazado, igual que calcularCrucesPared solo");
assert(Math.abs(esperado.longitudTotalConAlturaM - 5.4) < 1e-9, `longitudTotalConAlturaM suma el extra de altura al total (real: ${esperado.longitudTotalConAlturaM}, esperado 5.4)`);

// --- 10. Una ruta vinculada a un TABLERO (no a un equipo) nunca encuentra un "equipo" en su extremo -> cero cambio de comportamiento ---
const marcadorTablero = [{ id: "m1", punto: { x: 5, y: 0 }, tipo: "tablero_electrico", entidadId: "t1" }];
const sinEquipoCoincidente = calcularExtraAlturaInstalacion(ruta, nodos, marcadorTablero, equipoPiso /* busca por id "e1", no "t1" */, [], null);
assert(sinEquipoCoincidente.aplica === false, "Un marcador de TABLERO en el extremo nunca matchea contra la lista de equipos -> sin extra, sin romper nada");

console.log("\nTodas las pruebas completadas.");
