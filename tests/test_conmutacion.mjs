import { ApplicationMediator as App } from "../src/core/ApplicationMediator.ts";

let fallos = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FALLÓ:", msg); fallos++; }
  else console.log("OK:", msg);
}

// 1. normalizarConmutacion — defaults seguros
const vacia = App.origen.normalizarConmutacion({});
assert(vacia.activa === false && vacia.modo === "falla_automatica" && vacia.fuentePrincipalId === "acometida", "normalizarConmutacion({}) cae a los defaults esperados");

// 2. modo inválido cae al default, no inventa otro string
const modoRaro = App.origen.normalizarConmutacion({ modo: "telepatia" });
assert(modoRaro.modo === "falla_automatica", "modo inválido cae a falla_automatica");

// 3. Crear tablero con conmutación, vía editarTablero
const t1 = App.tablero.crear({ nombre: "Casa", tensionAlimentacion: "120", fases: "mono", tableroPadreId: null, longitudAlimentador: "5", materialAlimentador: "cobre" });
assert(t1.conmutacion === null, "tablero recién creado sin conmutación -> null");

const bateria = App.origen.crearFuente({ nombre: "Banco solar", tipo: "bateria", rol: "secundaria" });
const generador = App.origen.crearFuente({ nombre: "Generador diesel", tipo: "generador", rol: "auxiliar" });

const conmutacionDeseada = App.origen.normalizarConmutacion({
  activa: true,
  modo: "horario",
  fuentePrincipalId: "acometida",
  fuenteSecundariaId: bateria.id,
  fuenteAuxiliarId: generador.id,
  horarioPrincipalInicio: "06:00",
  horarioPrincipalFin: "18:00",
  notas: "Red de día, batería de noche, generador si falla todo",
});
const t2 = App.tablero.editar(t1, { conmutacion: conmutacionDeseada });
assert(t2.conmutacion.activa === true && t2.conmutacion.fuenteSecundariaId === bateria.id, "editarTablero guarda el esquema de conmutación completo");
assert(t2.conmutacion.horarioPrincipalInicio === "06:00", "horarios se preservan");

// 4. Validación referencial: conmutación con fuentes reales no genera error
const lista = App.validacion.listaIntegridad({ id: "p1" }, [{ id: "c1", tableroId: t2.id }], [], [t2], [bateria, generador]);
const entrada = lista.find((e) => e.tipo === "tablero" && e.id === t2.id);
assert(entrada && !entrada.problemas.some((p) => p.includes("Conmutación")), `conmutación con fuentes reales no genera error (problemas: ${JSON.stringify(entrada?.problemas)})`);

// 5. Validación referencial: conmutación con una fuente inexistente SÍ genera error
const conRoto = App.tablero.editar(t1, { conmutacion: App.origen.normalizarConmutacion({ activa: true, fuenteSecundariaId: "id-fantasma" }) });
const lista2 = App.validacion.listaIntegridad({ id: "p1" }, [{ id: "c2", tableroId: conRoto.id }], [], [conRoto], [bateria, generador]);
const entrada2 = lista2.find((e) => e.tipo === "tablero" && e.id === conRoto.id);
assert(entrada2 && entrada2.problemas.some((p) => p.includes("Conmutación") && p.includes("fuenteSecundariaId")), "conmutación con fuente inexistente SÍ genera error referencial");

// 6. Conmutación INACTIVA con referencia rota NO genera error (no se valida si activa=false)
const inactivaConRoto = App.tablero.editar(t1, { conmutacion: App.origen.normalizarConmutacion({ activa: false, fuenteSecundariaId: "id-fantasma" }) });
const lista3 = App.validacion.listaIntegridad({ id: "p1" }, [{ id: "c3", tableroId: inactivaConRoto.id }], [], [inactivaConRoto], [bateria, generador]);
const entrada3 = lista3.find((e) => e.tipo === "tablero" && e.id === inactivaConRoto.id);
assert(entrada3 && !entrada3.problemas.some((p) => p.includes("Conmutación")), "conmutación inactiva no se valida aunque tenga referencias rotas");

// 7. Persistencia round-trip conserva conmutación dentro del tablero
const serializado = App.persistencia.serializar({ proyecto: { id: "p1", nombre: "x" }, normativaActiva: "NEC", tipoInstalacion: "domiciliaria", circuitos: [], equipos: [], tableros: [t2], fuentesEnergia: [bateria, generador] });
const deserializado = App.persistencia.deserializar(serializado);
assert(deserializado.tableros[0].conmutacion.modo === "horario", "conmutación persiste correctamente dentro de tableros[].conmutacion");

console.log(fallos === 0 ? "\nTODOS LOS CHECKS PASARON" : `\n${fallos} CHECK(S) FALLARON`);
process.exit(fallos === 0 ? 0 : 1);
