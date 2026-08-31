/**
 * Módulo Motor — funciones internas de cálculo eléctrico.
 * Solo se usan entre sí o a través de MotorCalculoMediator.
 * No importan UI, documentos, diagramas ni el catálogo de normativas.
 */
export { calcularCircuito } from "./calcularCircuito.js";
export { calcularCorriente, potenciaDesdeCorriente } from "./corriente.js";
export { calcularCaidaTension } from "./caidaTension.js";
export { seleccionarBreaker } from "./breaker.js";
export { resistenciaOhmKm } from "./resistencia.js";
export { combinarCargas, potenciaDeEquipo } from "./cargaCombinada.js";
export { calcularCargasDemanda } from "./factorDemanda.js";
export { calcularLlenadoConducto } from "./canalizacion.js";
export {
  calcularCortocircuitoTrifasico,
  calcularCortocircuitoMonofasico,
  verificarCapacidadInterrupcion,
} from "./cortocircuito.js";
export { seleccionarSeccion } from "./seleccionSeccion.js";
export { combinarResultadosCircuitos } from "./combinarResultadosCircuitos.js";
export { calcularAlimentador } from "./calcularAlimentador.js";
// balanceFases: pendiente de entidad Tablero
