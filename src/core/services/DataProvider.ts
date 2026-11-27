/**
 * DataProvider — entrega datos solicitados al resto de la app.
 * No realiza cálculos. Fuente única de lectura de estado de proyecto
 * y tablas de referencia (vía Repository).
 *
 * El estado mutable del proyecto (circuitos, equipos) lo inyecta
 * ApplicationMediator / el hook; este servicio solo expone acceso
 * controlado.
 */
import { Repository } from "./Repository.ts";
import { Logger } from "./Logger.ts";
import type { Circuito, Equipo, Tablero, FuenteEnergia, Transformador, Diferencial, Proyecto } from "../../modules/validacion/tipos.ts";
import type { NodoDiagrama, ConexionDiagrama } from "../../modules/diagrama/tipos.ts";
import type { ResultadoCircuito } from "../../modules/motor/tipos.ts";

/**
 * Snapshot del estado del proyecto que este servicio expone — NO es
 * (todavía) el modelo canónico completo, que sigue viviendo en
 * hooks/useCircuitos.js hasta que esa etapa de la migración a
 * TypeScript llegue (ver la nota gemela en modules/diagrama/tipos.ts).
 * Reusa las formas MÍNIMAS ya definidas para motor/validación/diagrama
 * — lo suficiente para lo que este servicio en sí necesita (sobre todo
 * `id`, para los `.find` de abajo), no una forma inventada en paralelo.
 */
export interface SnapshotDatos {
  proyecto: Proyecto | null;
  circuitos: Circuito[];
  equipos: Equipo[];
  tableros: Tablero[];
  fuentesEnergia: FuenteEnergia[];
  transformadores: Transformador[];
  diferenciales: Diferencial[];
  nodosDiagrama: NodoDiagrama[];
  conexionesDiagrama: ConexionDiagrama[];
  normativaActiva: string;
  tipoInstalacion: string | null;
  resultados: ResultadoCircuito[];
}

/** Estado en memoria del documento activo (lo rellena ApplicationMediator). */
let snapshot: SnapshotDatos = {
  proyecto: null,
  circuitos: [],
  equipos: [],
  tableros: [],
  fuentesEnergia: [],
  transformadores: [],
  diferenciales: [],
  nodosDiagrama: [],
  conexionesDiagrama: [],
  normativaActiva: "NEC",
  tipoInstalacion: null,
  resultados: [],
};

export const DataProvider = {
  /** Actualiza el snapshot (solo ApplicationMediator debería llamarlo). */
  setSnapshot(partial: Partial<SnapshotDatos>): void {
    snapshot = { ...snapshot, ...partial };
  },

  getSnapshot(): SnapshotDatos {
    return snapshot;
  },

  getProyecto(): Proyecto | null {
    return snapshot.proyecto;
  },

  getCircuitos(): Circuito[] {
    return snapshot.circuitos;
  },

  getEquipos(): Equipo[] {
    return snapshot.equipos;
  },

  getEquiposDeCircuito(circuitoId: string): Equipo[] {
    return snapshot.equipos.filter((e) => e.circuitoId === circuitoId);
  },

  getCircuito(id: string): Circuito | null {
    return snapshot.circuitos.find((c) => c.id === id) ?? null;
  },

  getEquipo(id: string): Equipo | null {
    return snapshot.equipos.find((e) => e.id === id) ?? null;
  },

  getTableros(): Tablero[] {
    return snapshot.tableros;
  },

  getTablero(id: string): Tablero | null {
    return snapshot.tableros.find((t) => t.id === id) ?? null;
  },

  getFuentesEnergia(): FuenteEnergia[] {
    return snapshot.fuentesEnergia;
  },

  getFuenteEnergia(id: string): FuenteEnergia | null {
    return snapshot.fuentesEnergia.find((f) => f.id === id) ?? null;
  },

  getTransformadores(): Transformador[] {
    return snapshot.transformadores;
  },

  getTransformador(id: string): Transformador | null {
    return snapshot.transformadores.find((t) => t.id === id) ?? null;
  },

  getDiferenciales(): Diferencial[] {
    return snapshot.diferenciales;
  },

  getDiferencial(id: string): Diferencial | null {
    return snapshot.diferenciales.find((d) => d.id === id) ?? null;
  },

  getNodosDiagrama(): NodoDiagrama[] {
    return snapshot.nodosDiagrama;
  },

  getConexionesDiagrama(): ConexionDiagrama[] {
    return snapshot.conexionesDiagrama;
  },

  getNormativaActivaId(): string {
    return snapshot.normativaActiva;
  },

  getTipoInstalacion(): string | null {
    return snapshot.tipoInstalacion;
  },

  getResultados(): ResultadoCircuito[] {
    return snapshot.resultados;
  },

  getResultado(circuitoId: string): ResultadoCircuito | null {
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

  logState(): void {
    Logger.debug("DataProvider snapshot", {
      circuitos: snapshot.circuitos.length,
      equipos: snapshot.equipos.length,
      normativa: snapshot.normativaActiva,
    });
  },
};
