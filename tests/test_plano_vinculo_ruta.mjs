// Vínculo de una ruta de conductor a un circuito/tablero + autocompletar
// distancia — usuario, 2026-11-22, "sigamos con la autocompletar
// distancia desde el plano". Prueba a nivel ApplicationMediator:
// vincularRutaConductor, candidatosEntidadRuta (con exclusión del ya
// vinculado), resolverEntidadRuta.
import { ApplicationMediator as App } from "../src/core/ApplicationMediator.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

const circuito1 = { id: "c1", nombre: "Tomas cocina", distancia: 5 };
const circuito2 = { id: "c2", nombre: "Iluminación sala", distancia: 8 };
const tablero1 = App.tablero.crear({ nombre: "TD-sub1" });

// --- 1. crearRutaConductor: entidadId/entidadTipo arrancan en null ---
const nodos = [
  { id: "n1", punto: { x: 0, y: 0 } },
  { id: "n2", punto: { x: 3, y: 4 } },
];
const ruta = App.plano.crearRutaConductor(["n1", "n2"], nodos, "Ruta test");
assert(ruta.entidadId === null && ruta.entidadTipo === null, "Ruta recién creada: sin vínculo");
assert(Math.abs(ruta.longitudM - 5) < 1e-9, "Longitud 3-4-5 = 5m (sanity check)");

// --- 2. vincularRutaConductor ---
const rutaVinculada = App.plano.vincularRutaConductor(ruta, "c1", "circuito");
assert(rutaVinculada.entidadId === "c1" && rutaVinculada.entidadTipo === "circuito", "vincularRutaConductor asigna entidadId/entidadTipo");
assert(ruta.entidadId === null, "vincularRutaConductor NO muta la ruta original");

const rutaDesvinculada = App.plano.vincularRutaConductor(rutaVinculada, null);
assert(rutaDesvinculada.entidadId === null && rutaDesvinculada.entidadTipo === null, "vincularRutaConductor(ruta, null) desvincula ambos campos");

// --- 3. candidatosEntidadRuta: excluye lo ya vinculado por OTRAS rutas, no por la propia ---
const ruta2 = App.plano.crearRutaConductor(["n1", "n2"], nodos, "Ruta 2");
const rutaVinculadaAC1 = App.plano.vincularRutaConductor(ruta, "c1", "circuito");
const listaRutas = [rutaVinculadaAC1, ruta2];

const candidatosParaRuta2 = App.plano.candidatosEntidadRuta({ circuitos: [circuito1, circuito2], tableros: [tablero1], rutas: listaRutas, rutaId: ruta2.id });
assert(candidatosParaRuta2.circuitos.length === 1 && candidatosParaRuta2.circuitos[0].id === "c2", `Ruta2: c1 ya está tomado por la otra ruta, solo c2 disponible (real: ${JSON.stringify(candidatosParaRuta2.circuitos.map((c) => c.id))})`);
assert(candidatosParaRuta2.tableros.length === 1 && candidatosParaRuta2.tableros[0].id === tablero1.id, "Ruta2: el tablero sigue disponible (nadie lo tomó)");

// La ruta YA vinculada a c1 sigue viendo c1 en SU PROPIA lista de candidatos (no se auto-excluye).
const candidatosParaRuta1 = App.plano.candidatosEntidadRuta({ circuitos: [circuito1, circuito2], tableros: [tablero1], rutas: listaRutas, rutaId: rutaVinculadaAC1.id });
assert(candidatosParaRuta1.circuitos.some((c) => c.id === "c1"), "La propia ruta vinculada a c1 sigue viendo c1 como candidato (podría re-elegirlo sin problema)");

// --- 4. resolverEntidadRuta ---
const entidadResuelta = App.plano.resolverEntidadRuta(rutaVinculadaAC1, { circuitos: [circuito1, circuito2], tableros: [tablero1] });
assert(entidadResuelta?.id === "c1", `resolverEntidadRuta devuelve el circuito vinculado (real: ${entidadResuelta?.id})`);

const rutaVinculadaATablero = App.plano.vincularRutaConductor(ruta2, tablero1.id, "tablero");
const entidadTableroResuelta = App.plano.resolverEntidadRuta(rutaVinculadaATablero, { circuitos: [circuito1, circuito2], tableros: [tablero1] });
assert(entidadTableroResuelta?.id === tablero1.id, "resolverEntidadRuta devuelve el tablero vinculado cuando entidadTipo='tablero'");

const rutaSinVinculo = App.plano.crearRutaConductor(["n1", "n2"], nodos);
assert(App.plano.resolverEntidadRuta(rutaSinVinculo, { circuitos: [circuito1], tableros: [tablero1] }) === null, "Sin vínculo -> resolverEntidadRuta devuelve null");

// Entidad vinculada que ya no existe (fue borrada) -> null, no revienta.
const rutaVinculoMuerto = App.plano.vincularRutaConductor(ruta, "id-inexistente", "circuito");
assert(App.plano.resolverEntidadRuta(rutaVinculoMuerto, { circuitos: [circuito1], tableros: [] }) === null, "Vínculo a un id que ya no existe -> null, no revienta");

console.log("\nTodas las pruebas completadas.");
