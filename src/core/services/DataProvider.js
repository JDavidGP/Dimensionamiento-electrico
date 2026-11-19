/**
 * DataProvider — entrega datos solicitados al resto de la app.
 * No realiza cálculos. Fuente única de lectura de estado de proyecto
 * y tablas de referencia (vía Repository).
 *
 * El estado mutable del proyecto (circuitos, equipos) lo inyecta
 * ApplicationMediator / el hook; este servicio solo expone acceso
 * controlado.
 */
import { Repository } from "./Repository.js";
import { Logger } from "./Logger.js";

/** Estado en memoria del documento activo (lo rellena ApplicationMediator). */
let snapshot = {
  proyecto: null,
  circuitos: [],
  equipos: [],
  tableros: [],
  fuentesEnergia: [],
  transformadores: [],
  nodosDiagrama: [],
  conexionesDiagrama: [],
  normativaActiva: "NEC",
  tipoInstalacion: null,
  resultados: [],
};

export const DataProvider = {
  /** Actualiza el snapshot (solo ApplicationMediator debería llamarlo). */
  setSnapshot(partial) {
    snapshot = { ...snapshot, ...partial };
  },

  getSnapshot() {
    return snapshot;
  },

  getProyecto() {
    return snapshot.proyecto;
  },

  getCircuitos() {
    return snapshot.circuitos;
  },

  getEquipos() {
    return snapshot.equipos;
  },

  getEquiposDeCircuito(circuitoId) {
    return snapshot.equipos.filter((e) => e.circuitoId === circuitoId);
  },

  getCircuito(id) {
    return snapshot.circuitos.find((c) => c.id === id) ?? null;
  },

  getEquipo(id) {
    return snapshot.equipos.find((e) => e.id === id) ?? null;
  },

  getTableros() {
    return snapshot.tableros;
  },

  getTablero(id) {
    return snapshot.tableros.find((t) => t.id === id) ?? null;
  },

  getFuentesEnergia() {
    return snapshot.fuentesEnergia;
  },

  getFuenteEnergia(id) {
    return snapshot.fuentesEnergia.find((f) => f.id === id) ?? null;
  },

  getTransformadores() {
    return snapshot.transformadores;
  },

  getTransformador(id) {
    return snapshot.transformadores.find((t) => t.id === id) ?? null;
  },

  getNodosDiagrama() {
    return snapshot.nodosDiagrama;
  },

  getConexionesDiagrama() {
    return snapshot.conexionesDiagrama;
  },

  getNormativaActivaId() {
    return snapshot.normativaActiva;
  },

  getTipoInstalacion() {
    return snapshot.tipoInstalacion;
  },

  getResultados() {
    return snapshot.resultados;
  },

  getResultado(circuitoId) {
    return snapshot.resultados.find((r) => r.id === circuitoId) ?? null;
  },

  // --- Tablas de referencia (delegadas a Repository) ---
  tablas: {
    breakers: () => Repository.getBreakers(),
    materiales: () => Repository.getMateriales(),
    secciones: () => Repository.getSeccionesConductor(),
    tiposEquipo: () => Repository.getTiposEquipo(),
    plantillas: () => Repository.getPlantillas(),
  },

  logState() {
    Logger.debug("DataProvider snapshot", {
      circuitos: snapshot.circuitos.length,
      equipos: snapshot.equipos.length,
      normativa: snapshot.normativaActiva,
    });
  },
};
