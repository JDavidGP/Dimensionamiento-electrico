// Vista combinada "diagrama sobre plano" — resolución pura de
// conexiones del diagrama a puntos del plano vía entidadId compartido.
import { PlanoMediator } from "../src/core/mediators/PlanoMediator.js";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

const nodosDiagrama = [
  { id: "nd1", entidadId: "tab-1" },
  { id: "nd2", entidadId: "equipo-1" },
  { id: "nd3", entidadId: "fuente-1" },
  { id: "nd4", entidadId: null }, // sin vínculo
  { id: "nd5", entidadId: "equipo-sin-marcador" }, // vinculado pero sin marcador correspondiente
];

const marcadoresEquipoPlano = [
  { id: "m1", punto: { x: 1, y: 1 }, entidadId: "tab-1" },
  { id: "m2", punto: { x: 5, y: 1 }, entidadId: "equipo-1" },
  { id: "m3", punto: { x: 5, y: 5 }, entidadId: "fuente-1" },
];

const conexionesDiagrama = [
  { id: "cx1", nodoOrigenId: "nd1", nodoDestinoId: "nd2" }, // resoluble
  { id: "cx2", nodoOrigenId: "nd2", nodoDestinoId: "nd3" }, // resoluble
  { id: "cx3", nodoOrigenId: "nd1", nodoDestinoId: "nd4" }, // nd4 sin entidadId -> no resoluble
  { id: "cx4", nodoOrigenId: "nd1", nodoDestinoId: "nd5" }, // nd5 vinculado pero sin marcador -> no resoluble
];

const resultado = PlanoMediator.conexionesDiagramaEnPlano({ nodosDiagrama, conexionesDiagrama, marcadoresEquipoPlano });

assert(resultado.totalConexiones === 4, "totalConexiones cuenta las 4 conexiones del diagrama");
assert(resultado.conexiones.length === 2, `Solo 2 conexiones resolubles (reales: ${resultado.conexiones.length})`);
assert(resultado.sinResolver === 2, `2 conexiones sin resolver (reales: ${resultado.sinResolver})`);

const cx1 = resultado.conexiones.find((c) => c.id === "cx1");
assert(!!cx1, "cx1 está en las resueltas");
assert(cx1.puntoOrigen.x === 1 && cx1.puntoOrigen.y === 1, "cx1.puntoOrigen = marcador de tab-1 (1,1)");
assert(cx1.puntoDestino.x === 5 && cx1.puntoDestino.y === 1, "cx1.puntoDestino = marcador de equipo-1 (5,1)");

// Caso vacío
const vacio = PlanoMediator.conexionesDiagramaEnPlano({});
assert(vacio.conexiones.length === 0 && vacio.sinResolver === 0 && vacio.totalConexiones === 0, "Sin datos -> todo vacío, sin errores");

console.log(process.exitCode === 1 ? "\nHay fallos." : "\nTodo OK.");
