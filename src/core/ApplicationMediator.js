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
  OrigenMediator,
  EtiquetadoMediator,
  PlanoMediator,
  ImportacionMediator,
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
  origen: OrigenMediator,
  etiquetado: EtiquetadoMediator,
  plano: PlanoMediator,
  importacion: ImportacionMediator,

  /**
   * Sincroniza el snapshot del DataProvider con el estado de la UI/hook.
   * Debe llamarse cuando cambian proyecto, circuitos, equipos o resultados.
   */
  syncSnapshot({
    proyecto,
    circuitos,
    equipos,
    tableros,
    fuentesEnergia,
    transformadores,
    nodosDiagrama,
    conexionesDiagrama,
    normativaActiva,
    tipoInstalacion,
    resultados,
  } = {}) {
    const partial = {};
    if (proyecto !== undefined) partial.proyecto = proyecto;
    if (circuitos !== undefined) partial.circuitos = circuitos;
    if (equipos !== undefined) partial.equipos = equipos;
    if (tableros !== undefined) partial.tableros = tableros;
    if (fuentesEnergia !== undefined) partial.fuentesEnergia = fuentesEnergia;
    if (transformadores !== undefined) partial.transformadores = transformadores;
    if (nodosDiagrama !== undefined) partial.nodosDiagrama = nodosDiagrama;
    if (conexionesDiagrama !== undefined) partial.conexionesDiagrama = conexionesDiagrama;
    if (normativaActiva !== undefined) partial.normativaActiva = normativaActiva;
    if (tipoInstalacion !== undefined) partial.tipoInstalacion = tipoInstalacion;
    if (resultados !== undefined) partial.resultados = resultados;
    DataProvider.setSnapshot(partial);
  },

  /** Guardar / abrir proyecto — .pdf por defecto (usuario, 2026-11-22); .json queda disponible para quien lo prefiera. */
  guardarProyecto(estado) {
    return PersistenciaMediator.descargarPdf(estado);
  },

  guardarProyectoComoJson(estado) {
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
