// CRUD completo de Transformador (usuario, 2026-11-20): editar/eliminar
// + entrada propia de integridad (mismo patrón que fuentesEnergia) —
// antes solo existía "crear".
import { ApplicationMediator as App } from "../src/core/ApplicationMediator.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

const proyecto = { id: "p1", nombre: "Proyecto test" };

// --- 1. Crear ---
const trafo = App.origen.crearTransformador({ nombre: "TR-1", fases: "tri", tensionPrimariaV: "480", tensionSecundariaV: "240" });
assert(!!trafo.id, "Se crea con id propio");

// --- 2. Entrada propia de integridad: sin nodo, advertencia ---
let lista = App.validacion.listaIntegridad(proyecto, [], [], [], [], [], [trafo]);
let entrada = lista.find((e) => e.tipo === "transformador" && e.id === trafo.id);
assert(!!entrada, "El transformador aparece como su propia entrada en listaIntegridad");
assert(entrada.problemas.includes("Sin representar en el diagrama unifilar"), "Advertencia de representación presente");
assert(entrada.estado === "advertencia", "Estado advertencia, no error");
assert(entrada.resumen.includes("tri") && entrada.resumen.includes("480V→240V"), `El resumen trae fases y tensiones (real: '${entrada.resumen}')`);

// --- 3. Vinculado a un nodo del diagrama: la advertencia desaparece ---
const nodo = App.diagrama.crearNodo({ tipo: "transformador", nombre: "T1", posicion: { x: 0, y: 0 }, entidadId: trafo.id });
lista = App.validacion.listaIntegridad(proyecto, [], [], [], [], [nodo], [trafo]);
entrada = lista.find((e) => e.tipo === "transformador" && e.id === trafo.id);
assert(!entrada.problemas.includes("Sin representar en el diagrama unifilar"), "Tras vincular, la advertencia desaparece");
assert(entrada.estado === "ok", "Estado vuelve a ok");

// --- 4. Editar ---
const editado = App.origen.editarTransformador(trafo, { nombre: "TR-1-EDITADO", tensionPrimariaV: "600" });
assert(editado.nombre === "TR-1-EDITADO" && Number(editado.tensionPrimariaV) === 600, "editarTransformador aplica los cambios");
assert(editado.id === trafo.id, "El id no cambia al editar");
assert(editado.tensionSecundariaV === trafo.tensionSecundariaV, "Los campos no tocados se conservan");

// --- 5. Eliminar: tableros que lo usaban como padre quedan libres (null), no rotos ---
const tablero = App.tablero.crear({ nombre: "TD-IND", tensionAlimentacion: "240", fases: "tri", tableroPadreId: trafo.id });
const tablerosLiberados = App.origen.liberarTablerosDeTransformador(trafo.id, [tablero]);
assert(tablerosLiberados[0].tableroPadreId === null, "Al eliminar el transformador, el tablero que colgaba de él queda con padre null (acometida), no roto");

// --- 6. resumen() también cuenta el transformador sin representar ---
const resumenSinNodo = App.validacion.resumen(proyecto, [], [], [], [], [], [trafo]);
assert(resumenSinNodo.advertencia >= 1, "resumen() cuenta la advertencia del transformador sin representar");

console.log("\nTodas las pruebas completadas.");
