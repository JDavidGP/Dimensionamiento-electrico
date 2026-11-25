/**
 * Módulo Motor — funciones internas de cálculo eléctrico.
 * Solo se usan entre sí o a través de MotorCalculoMediator.
 * No importan UI, documentos, diagramas ni el catálogo de normativas.
 */
export { calcularCircuito } from "./calcularCircuito.ts";
export { calcularCorriente, potenciaDesdeCorriente } from "./corriente.ts";
export { calcularCaidaTension } from "./caidaTension.ts";
export { evaluarCaidaAcumulada } from "./caidaTensionAcumulada.ts";
export { seleccionarBreaker } from "./breaker.ts";
export { resistenciaOhmKm } from "./resistencia.ts";
export { combinarCargas, potenciaDeEquipo } from "./cargaCombinada.ts";
export { calcularCargasDemanda } from "./factorDemanda.ts";
export { claseCircuitoREBT } from "./claseCircuitoREBT.ts";
export { calcularLlenadoConducto } from "./canalizacion.ts";
export { diametroMinimoTuboREBT, TIPOS_INSTALACION_TUBO_REBT } from "./canalizacionREBT.ts";
export { factorAjusteConductoresPortadoresNEC, conductoresPortadoresCorriente } from "./ajusteAgrupamientoNEC.ts";
export { profundidadMinimaEnterradoNEC, CATEGORIAS_CONDUCTO_ENTERRADO_NEC, UBICACIONES_ENTERRADO_NEC } from "./profundidadEnterradoNEC.ts";
export { profundidadMinimaEnterradaREBT, separacionMinimaOtrasCanalizacionesREBT, factorAgrupacionTubosREBT, separacionABucket } from "./instalacionEnterradaREBT.ts";
export {
  calcularCortocircuitoTrifasico,
  calcularCortocircuitoMonofasico,
  verificarCapacidadInterrupcion,
  calcularImpedanciaTransformadorOhm,
  obtenerXRTransformador,
} from "./cortocircuito.ts";
export { seleccionarSeccion } from "./seleccionSeccion.ts";
export { combinarResultadosCircuitos } from "./combinarResultadosCircuitos.ts";
export { calcularAlimentador } from "./calcularAlimentador.ts";
export { balanceFases } from "./balanceFases.ts";
export {
  TRANSFORMADOR_VACIO,
  normalizarTransformador,
  calcularCorrientesNominales,
  crearTransformador,
  editarTransformador,
  liberarTablerosDeTransformador,
} from "./transformador.ts";
export {
  TAMANOS_ESTANDAR_NEC_240_6_A,
  seleccionarProteccionTransformador,
  TAMANOS_ESTANDAR_IEC_60947_2,
  seleccionarProteccionTransformadorREBT,
} from "./proteccionTransformador.ts";
export {
  TABLA_COEFICIENTE_SIMULTANEIDAD,
  coeficienteSimultaneidad,
  GRADOS_ELECTRIFICACION,
  potenciaMinimaGrado,
  calcularCargaSimultaneaViviendas,
  SIMULTANEIDAD_REBT_VACIA,
  normalizarSimultaneidadREBT,
  ESQUEMAS_CONTADORES,
  limiteCaidaTensionDI_REBT,
} from "./simultaneidadREBT.ts";

export type { Equipo, Circuito, Tablero, Fases, ClaseCircuitoREBT, ResultadoCircuito, ImpedanciaFuente, DetalleDemandaTipo } from "./tipos.ts";
export type { ContextoInstalacionCircuito } from "./calcularCircuito.ts";
export type { Transformador, ResultadoCorrientesNominales, TableroConPadre } from "./transformador.ts";
export type { SimultaneidadREBT, GradoElectrificacion, ResultadoCargaSimultaneaViviendas, EsquemaContadores } from "./simultaneidadREBT.ts";
export type { ResultadoAlimentador } from "./calcularAlimentador.ts";
export type {
  EsquemaProteccionTransformador,
  ParametrosProteccionTransformador,
  ResultadoProteccionTransformador,
  ParametrosProteccionTransformadorREBT,
  ResultadoProteccionTransformadorREBT,
} from "./proteccionTransformador.ts";
export type { ResultadoCombinado } from "./combinarResultadosCircuitos.ts";
export type { CargaCombinada } from "./cargaCombinada.ts";
export type { CargasDemanda } from "./factorDemanda.ts";
export type { ConductorCanalizacion, ResultadoLlenadoConducto } from "./canalizacion.ts";
export type { SeccionSeleccionada, ParametrosSeleccionSeccion } from "./seleccionSeccion.ts";
export type { ParametrosCaidaTension, ResultadoCaidaTension } from "./caidaTension.ts";
export type { ResultadoBreaker } from "./breaker.ts";
export type { CaidaAcumulada } from "./caidaTensionAcumulada.ts";
export type { BalanceFases } from "./balanceFases.ts";
export type {
  ResultadoCortocircuitoTrifasico,
  ResultadoCortocircuitoMonofasico,
  ResultadoCapacidadInterrupcion,
  ResultadoImpedanciaTransformador,
  TipoRefrigeracionTransformador,
  ResultadoXRTransformador,
} from "./cortocircuito.ts";
