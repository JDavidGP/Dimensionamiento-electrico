import { ApplicationMediator as App } from "../src/core/ApplicationMediator.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

// --- 1. CRUD básico ---
const transformador = App.origen.crearTransformador({ nombre: "TR-1", fases: "tri", tensionPrimariaV: "480", tensionSecundariaV: "240" });
assert(!!transformador.id, "crearTransformador asigna id");
assert(transformador.nombre === "TR-1" && transformador.fases === "tri", "crearTransformador normaliza los datos dados");
assert(transformador.capacidadKVA === "", "crearTransformador cae a TRANSFORMADOR_VACIO para los campos no provistos (capacidadKVA)");

const editado = App.origen.editarTransformador(transformador, { nombre: "TR-1-editado" });
assert(editado.nombre === "TR-1-editado" && editado.id === transformador.id, "editarTransformador aplica cambios sin perder el id");

// --- 2. resolverOrigen reconoce transformadores como tercer catálogo ---
const tableros = [];
const fuentesEnergia = [];
const transformadores = [transformador];
const resuelto = App.origen.resolver(transformador.id, tableros, fuentesEnergia, transformadores);
assert(resuelto.tipo === "transformador" && resuelto.transformador.id === transformador.id, "resolver() identifica un origenId de transformador correctamente");

const resueltoDesconocido = App.origen.resolver("id-inventado", tableros, fuentesEnergia, transformadores);
assert(resueltoDesconocido.tipo === "desconocido", "resolver() sigue reportando 'desconocido' para ids que no están en ningún catálogo");

// --- 3. liberarTablerosDeTransformador ---
const tablero = App.tablero.crear({ nombre: "TD-1", tableroPadreId: transformador.id });
const tablerosLiberados = App.origen.liberarTablerosDeTransformador(transformador.id, [tablero]);
assert(tablerosLiberados[0].tableroPadreId === null, "liberarTablerosDeTransformador pone tableroPadreId en null, no lo deja apuntando a un id muerto");

// --- 4. validarTablero: tableroPadreId = transformador real NO es un error ---
const tableroConTransformador = App.tablero.crear({ nombre: "TD-2", tableroPadreId: transformador.id });
const lista = App.validacion.listaIntegridad({ id: "p1" }, [], [], [tableroConTransformador], [], [], [transformador]);
const entradaTablero = lista.find((e) => e.tipo === "tablero" && e.id === tableroConTransformador.id);
assert(
  !entradaTablero.problemas.some((p) => p.includes("inexistente")),
  `tablero con padre = transformador real NO se marca como referencia inexistente (problemas: ${JSON.stringify(entradaTablero.problemas)})`
);

const tableroConPadreMuerto = App.tablero.crear({ nombre: "TD-3", tableroPadreId: "id-que-no-existe" });
const lista2 = App.validacion.listaIntegridad({ id: "p1" }, [], [], [tableroConPadreMuerto], [], [], [transformador]);
const entradaTablero2 = lista2.find((e) => e.tipo === "tablero" && e.id === tableroConPadreMuerto.id);
assert(
  entradaTablero2.problemas.some((p) => p.includes("inexistente")),
  "tablero con padre inexistente en NINGÚN catálogo (ni transformadores) SÍ se marca como error"
);

// --- 5. Sincronización con el diagrama: candidatosEntidad / resolverEntidad ---
const candidatos = App.diagrama.candidatosEntidad("transformador", { tableros: [], equipos: [], fuentesEnergia: [], transformadores, nodos: [] });
assert(candidatos.length === 1 && candidatos[0].id === transformador.id, "candidatosEntidad('transformador') devuelve el transformador");

const nodo = App.diagrama.crearNodo({ tipo: "transformador", nombre: "T1", posicion: { x: 0, y: 0 }, entidadId: transformador.id });
const entidadResuelta = App.diagrama.resolverEntidad(nodo, { tableros: [], equipos: [], fuentesEnergia: [], transformadores });
assert(entidadResuelta?.id === transformador.id, "resolverEntidad resuelve un nodo 'transformador' vinculado");

const nodosLiberados = App.diagrama.liberarNodosDeEntidad(transformador.id, [nodo]);
assert(nodosLiberados[0].entidadId === null, "liberarNodosDeEntidad desvincula el nodo si su transformador se elimina (genérico, ya funcionaba)");

// --- 6. Persistencia: round-trip incluye transformadores, con fallback de compatibilidad ---
const serializado = App.persistencia.serializar({
  proyecto: { id: "p1", nombre: "Test" },
  normativaActiva: "NEC",
  tipoInstalacion: "industrial",
  circuitos: [],
  equipos: [],
  tableros: [],
  fuentesEnergia: [],
  transformadores: [transformador],
  nodosDiagrama: [],
  conexionesDiagrama: [],
});
assert(Array.isArray(serializado.transformadores) && serializado.transformadores.length === 1, "serializar() incluye transformadores");

const deserializado = App.persistencia.deserializar(serializado);
assert(deserializado.transformadores.length === 1 && deserializado.transformadores[0].nombre === "TR-1", "deserializar() recupera transformadores correctamente");

const sinTransformadores = { ...serializado };
delete sinTransformadores.transformadores;
const deserializadoViejo = App.persistencia.deserializar(sinTransformadores);
assert(Array.isArray(deserializadoViejo.transformadores) && deserializadoViejo.transformadores.length === 0, "archivo sin transformadores (formato anterior) cae a [] sin error");

console.log("\nTodas las pruebas completadas.");
