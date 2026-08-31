/**
 * ApplicationMediator — coordinador principal.
 *
 * UI → ApplicationMediator → mediadores de dominio.
 * Los módulos NO se conocen entre sí; solo a través de mediadores.
 *
 * Flujo típico:
 *   UI → calcularTodos → MotorCalculoMediator (+ NormativaMediator)
 *      → validar → ValidacionMediator
 *      → guardar → PersistenciaMediator
 */
import { DataProvider } from "./services/DataProvider.js";
import { Logger } from "./services/Logger.js";
import { Config } from "./services/Config.js";
import {
  MotorCalculoMediator,
  NormativaMediator,
  ValidacionMediator,
  PersistenciaMediator,
  DocumentoMediator,
  DiagramaMediator,
  TableroMediator,
} from "./mediators/index.js";

export const ApplicationMediator = {
  // --- Servicios expuestos de forma controlada ---
  config: Config,
  logger: Logger,
  data: DataProvider,

  // --- Mediadores de dominio ---
  motor: MotorCalculoMediator,
  normativa: NormativaMediator,
  validacion: ValidacionMediator,
  persistencia: PersistenciaMediator,
  documento: DocumentoMediator,
  diagrama: DiagramaMediator,
  tablero: TableroMediator,

  /**
   * Sincroniza el snapshot del DataProvider con el estado de la UI/hook.
   * Debe llamarse cuando cambian proyecto, circuitos, equipos o resultados.
   */
  syncSnapshot({
    proyecto,
    circuitos,
    equipos,
    tableros,
    normativaActiva,
    resultados,
  } = {}) {
    const partial = {};
    if (proyecto !== undefined) partial.proyecto = proyecto;
    if (circuitos !== undefined) partial.circuitos = circuitos;
    if (equipos !== undefined) partial.equipos = equipos;
    if (tableros !== undefined) partial.tableros = tableros;
    if (normativaActiva !== undefined) partial.normativaActiva = normativaActiva;
    if (resultados !== undefined) partial.resultados = resultados;
    DataProvider.setSnapshot(partial);
  },

  /** Recalcula todos los circuitos y devuelve resultados. */
  calcularProyecto(circuitos, equipos, normativaId) {
    const resultados = MotorCalculoMediator.calcularTodos(
      circuitos,
      equipos,
      normativaId
    );
    DataProvider.setSnapshot({ resultados });
    return resultados;
  },

  /** Lista de integridad + resumen en un solo paso. */
  integridad(proyecto, circuitos, equipos, tableros) {
    return {
      lista: ValidacionMediator.listaIntegridad(proyecto, circuitos, equipos, tableros),
      resumen: ValidacionMediator.resumen(proyecto, circuitos, equipos, tableros),
    };
  },

  /** Guardar / abrir proyecto. */
  guardarProyecto(estado) {
    return PersistenciaMediator.descargarJson(estado);
  },

  async abrirProyecto(archivo) {
    return PersistenciaMediator.abrirDesdeArchivo(archivo);
  },

  nuevoProyecto() {
    return PersistenciaMediator.proyectoVacio();
  },
};

export default ApplicationMediator;
