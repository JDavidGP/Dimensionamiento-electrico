import { ApplicationMediator as App } from "../src/core/ApplicationMediator.ts";

let fallos = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FALLÓ:", msg); fallos++; }
  else console.log("OK:", msg);
}

// 1. Crear fuentes
const bateria = App.origen.crearFuente({ nombre: "Banco solar", tipo: "bateria", rol: "secundaria" });
const generador = App.origen.crearFuente({ nombre: "Generador diesel 10kW", tipo: "generador", rol: "auxiliar" });
assert(bateria.id && bateria.tipo === "bateria" && bateria.rol === "secundaria", "crearFuente(batería) normaliza tipo/rol correctamente");
assert(generador.tipo === "generador" && generador.rol === "auxiliar", "crearFuente(generador) normaliza tipo/rol correctamente");

// 2. normalizar() defaults — tipo/rol inválido cae a default, no inventa otro string
const fuenteRara = App.origen.crearFuente({ nombre: "X", tipo: "fusion_nuclear", rol: "jefe" });
// Rediseño de rol global (usuario, 2026-11-20): rol ahora es opcional
// ("" = sin rol asignado), no uno de los 3 roles por defecto — un rol
// inválido cae a "" (nunca inventa un rol real que el usuario no eligió).
assert(fuenteRara.tipo === "bateria" && fuenteRara.rol === "", "tipo inválido cae a 'bateria'; rol inválido cae a '' (sin rol), no a un rol inventado");

// 3. resolverOrigen (vía OrigenMediator) — null, tablero, fuente, desconocido
const tableros = [{ id: "t1", nombre: "Principal", fases: "tri", tableroPadreId: null }];
const fuentes = [bateria, generador];

assert(App.origen.resolver(null, tableros, fuentes).tipo === "acometida", "origenId null -> acometida");
assert(App.origen.resolver("t1", tableros, fuentes).tipo === "tablero", "origenId de un tablero real -> tablero");
const resueltoBateria = App.origen.resolver(bateria.id, tableros, fuentes);
assert(resueltoBateria.tipo === "bateria" && resueltoBateria.fuente.nombre === "Banco solar", "origenId de una batería -> tipo 'bateria' con la fuente resuelta");
const resueltoGenerador = App.origen.resolver(generador.id, tableros, fuentes);
assert(resueltoGenerador.tipo === "generador" && resueltoGenerador.fuente.rol === "auxiliar", "origenId de un generador -> tipo 'generador', rol preservado");
assert(App.origen.resolver("id-inventado", tableros, fuentes).tipo === "desconocido", "origenId que no existe en ningún catálogo -> desconocido");

// 4. Validación referencial: un tablero cuyo tableroPadreId apunta a una fuente real NO debe marcarse como "referencia inexistente"
const t2 = { id: "t2", nombre: "SubCocina", fases: "mono", tableroPadreId: generador.id };
const circuitosFalsos = [{ id: "c1", tableroId: "t2" }]; // para que no marque "sin circuitos"
const lista = App.validacion.listaIntegridad({ id: "proy" }, circuitosFalsos, [], [t2], fuentes);
const entradaT2 = lista.find((e) => e.tipo === "tablero" && e.id === "t2");
assert(entradaT2 && !entradaT2.problemas.some((p) => p.includes("inexistente")), `tablero con padre = fuente real NO se marca como referencia inexistente (problemas: ${JSON.stringify(entradaT2?.problemas)})`);

// 5. Validación referencial: un tablero cuyo tableroPadreId NO existe en ningún catálogo SÍ debe marcarse
const t3 = { id: "t3", nombre: "Roto", fases: "mono", tableroPadreId: "id-fantasma" };
const lista2 = App.validacion.listaIntegridad({ id: "proy" }, [{ id: "c2", tableroId: "t3" }], [], [t3], fuentes);
const entradaT3 = lista2.find((e) => e.tipo === "tablero" && e.id === "t3");
assert(entradaT3 && entradaT3.problemas.some((p) => p.includes("inexistente")), "tablero con padre inexistente en ningún catálogo SÍ se marca como error");

// 6. eliminar fuente libera tableros que la referenciaban
const tablerosConFuente = [t2];
const liberados = App.origen.liberarTableros(generador.id, tablerosConFuente);
assert(liberados[0].tableroPadreId === null, "liberarTableros() pone tableroPadreId en null al borrar la fuente referenciada");

// 7. Persistencia: serializar/deserializar incluye fuentesEnergia
const serializado = App.persistencia.serializar({ proyecto: { id: "p1", nombre: "Test" }, normativaActiva: "NEC", tipoInstalacion: "industrial", circuitos: [], equipos: [], tableros: [t2], fuentesEnergia: fuentes });
assert(Array.isArray(serializado.fuentesEnergia) && serializado.fuentesEnergia.length === 2, "serializar() incluye fuentesEnergia");
const deserializado = App.persistencia.deserializar(serializado);
assert(deserializado.fuentesEnergia.length === 2 && deserializado.fuentesEnergia[0].nombre === "Banco solar", "deserializar() recupera fuentesEnergia correctamente");

// 8. Compatibilidad hacia atrás: un archivo viejo sin fuentesEnergia no revienta
const archivoViejo = { circuitos: [], equipos: [], tableros: [], normativaActiva: "NEC" };
const deserializadoViejo = App.persistencia.deserializar(archivoViejo);
assert(Array.isArray(deserializadoViejo.fuentesEnergia) && deserializadoViejo.fuentesEnergia.length === 0, "archivo sin fuentesEnergia (formato anterior) cae a [] sin error");

console.log(fallos === 0 ? "\nTODOS LOS CHECKS PASARON" : `\n${fallos} CHECK(S) FALLARON`);
process.exit(fallos === 0 ? 0 : 1);
