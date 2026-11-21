import { ApplicationMediator as App } from "../src/core/ApplicationMediator.js";

let fallos = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FALLÓ:", msg); fallos++; }
  else console.log("OK:", msg);
}

// 1. Catálogo expuesto y con las ~25 entradas esperadas
const catalogo = App.diagrama.CATALOGO_COMPONENTES;
assert(Array.isArray(catalogo) && catalogo.length >= 24, `catálogo tiene ${catalogo.length} componentes (esperado >=24)`);
assert(App.diagrama.obtenerComponente("tablero_electrico")?.entidadVinculada === "tablero", "tablero_electrico está vinculado a la entidad 'tablero'");
assert(App.diagrama.obtenerComponente("interruptor_principal")?.puntosConexion.entradas === 1, "interruptor_principal admite máx. 1 entrada (regla que citó el usuario)");
assert(App.diagrama.obtenerComponente("barra_distribucion")?.puntosConexion.salidas === Infinity, "barra_distribucion admite salidas ilimitadas");
assert(App.diagrama.obtenerComponente("algo_que_no_existe") === null, "obtenerComponente de un tipo inexistente devuelve null, no inventa uno");

// 2. Crear nodos
const acometida = App.diagrama.crearNodo({ tipo: "acometida", nombre: "Acometida principal", posicion: { x: 0, y: 0 } });
const principal = App.diagrama.crearNodo({ tipo: "interruptor_principal", nombre: "Main breaker", posicion: { x: 100, y: 0 } });
const tableroNodo = App.diagrama.crearNodo({ tipo: "tablero_electrico", nombre: "TP", posicion: { x: 200, y: 0 } });
assert(acometida.id && acometida.posicion.x === 0 && acometida.estado === "activo", "crearNodo normaliza posición y estado por defecto");

// 3. Conexión válida
const r1 = App.diagrama.crearConexionValidada({ nodoOrigenId: acometida.id, nodoDestinoId: principal.id }, [acometida, principal, tableroNodo], []);
assert(r1.ok === true, "conexión acometida -> interruptor principal es válida");

// 4. Segunda conexión AL interruptor_principal (ya tiene 1 entrada usada) -> debe rechazarse por cardinalidad
const otraFuente = App.diagrama.crearNodo({ tipo: "acometida", nombre: "Otra", posicion: { x: 0, y: 50 } });
const r2 = App.diagrama.crearConexionValidada({ nodoOrigenId: otraFuente.id, nodoDestinoId: principal.id }, [acometida, principal, tableroNodo, otraFuente], [r1.conexion]);
assert(r2.ok === false && r2.motivo.includes("entrada"), `segunda entrada al interruptor_principal se rechaza por cardinalidad (motivo: "${r2.motivo}")`);

// 5. Auto-conexión rechazada
const r3 = App.diagrama.crearConexionValidada({ nodoOrigenId: principal.id, nodoDestinoId: principal.id }, [acometida, principal, tableroNodo], []);
assert(r3.ok === false && r3.motivo.includes("mismo"), "un nodo no puede conectarse a sí mismo");

// 6. Nodo inexistente rechazado
const r4 = App.diagrama.crearConexionValidada({ nodoOrigenId: "id-fantasma", nodoDestinoId: principal.id }, [acometida, principal, tableroNodo], []);
assert(r4.ok === false && r4.motivo.includes("no existe"), "conexión con nodo de origen inexistente se rechaza");

// 7. Conexión duplicada rechazada
const r5 = App.diagrama.crearConexionValidada({ nodoOrigenId: principal.id, nodoDestinoId: tableroNodo.id }, [acometida, principal, tableroNodo], []);
assert(r5.ok === true, "interruptor principal -> tablero es válida");
const r6 = App.diagrama.crearConexionValidada({ nodoOrigenId: principal.id, nodoDestinoId: tableroNodo.id }, [acometida, principal, tableroNodo], [r5.conexion]);
assert(r6.ok === false && r6.motivo.includes("idéntica"), "no se permite una conexión idéntica duplicada");

// 8. Múltiples salidas desde el tablero (barra con salidas Infinity) -> todas válidas
const carga1 = App.diagrama.crearNodo({ tipo: "luminaria", nombre: "Luz 1" });
const carga2 = App.diagrama.crearNodo({ tipo: "contacto", nombre: "Toma 1" });
const conexionesPrevias = [r1.conexion, r5.conexion];
const r7 = App.diagrama.crearConexionValidada({ nodoOrigenId: tableroNodo.id, nodoDestinoId: carga1.id }, [acometida, principal, tableroNodo, carga1, carga2], conexionesPrevias);
assert(r7.ok === true, "primera salida del tablero hacia una carga es válida");
const r8 = App.diagrama.crearConexionValidada({ nodoOrigenId: tableroNodo.id, nodoDestinoId: carga2.id }, [acometida, principal, tableroNodo, carga1, carga2], [...conexionesPrevias, r7.conexion]);
assert(r8.ok === true, "segunda salida del tablero (salidas ilimitadas) también es válida");

// 9. eliminar nodo limpia sus conexiones
const todasConexiones = [r1.conexion, r5.conexion, r7.conexion, r8.conexion];
const tras = App.diagrama.conexionesTrasEliminarNodo(principal.id, todasConexiones);
assert(tras.length === 2 && !tras.some((c) => c.nodoOrigenId === principal.id || c.nodoDestinoId === principal.id), "eliminar un nodo elimina sus conexiones, no las deja rotas");

// 10. Persistencia round-trip
const serializado = App.persistencia.serializar({
  proyecto: { id: "p1", nombre: "x" }, normativaActiva: "NEC", tipoInstalacion: "domiciliaria",
  circuitos: [], equipos: [], tableros: [], fuentesEnergia: [],
  nodosDiagrama: [acometida, principal, tableroNodo], conexionesDiagrama: [r1.conexion, r5.conexion],
});
assert(Array.isArray(serializado.nodosDiagrama) && serializado.nodosDiagrama.length === 3, "serializar() incluye nodosDiagrama");
const deserializado = App.persistencia.deserializar(serializado);
assert(deserializado.conexionesDiagrama.length === 2, "deserializar() recupera conexionesDiagrama");

// 11. Compatibilidad hacia atrás: archivo viejo sin diagrama no revienta
const archivoViejo = { circuitos: [], equipos: [], tableros: [], normativaActiva: "NEC" };
const deserializadoViejo = App.persistencia.deserializar(archivoViejo);
assert(Array.isArray(deserializadoViejo.nodosDiagrama) && deserializadoViejo.nodosDiagrama.length === 0, "archivo sin nodosDiagrama (formato anterior) cae a [] sin error");

console.log(fallos === 0 ? "\nTODOS LOS CHECKS PASARON" : `\n${fallos} CHECK(S) FALLARON`);
process.exit(fallos === 0 ? 0 : 1);
