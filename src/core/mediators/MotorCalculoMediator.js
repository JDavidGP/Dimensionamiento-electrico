/**
 * MotorCalculoMediator
 * Coordina cálculos eléctricos.
 * Dependencias permitidas: DataProvider, NormativaMediator, funciones internas del motor.
 * NO depende de: UI, documentos, diagramas.
 */
import { calcularCircuito as calcInterno } from "../../modules/motor/calcularCircuito.js";
import {
  calcularCorriente,
  potenciaDesdeCorriente,
  calcularCaidaTension,
  seleccionarBreaker,
  combinarCargas,
  calcularCargasDemanda,
  calcularLlenadoConducto,
  calcularCortocircuitoTrifasico,
  calcularCortocircuitoMonofasico,
  verificarCapacidadInterrupcion,
} from "../../modules/motor/index.js";
import { NormativaMediator } from "./NormativaMediator.js";
import { DataProvider } from "../services/DataProvider.js";
import { Logger } from "../services/Logger.js";

export const MotorCalculoMediator = {
  /**
   * Dimensiona un circuito. Resuelve la normativa vía NormativaMediator
   * e inyecta el objeto al motor puro.
   */
  calcularCircuito(circuito, equipos, normativaId) {
    const id = normativaId ?? DataProvider.getNormativaActivaId();
    const normativa = NormativaMediator.obtener(id);
    try {
      return calcInterno(circuito, equipos, normativa);
    } catch (err) {
      Logger.error("MotorCalculoMediator.calcularCircuito", err);
      return {
        ok: false,
        id: circuito?.id,
        nombre: circuito?.nombre,
        error: err.message || "Error en cálculo de circuito",
      };
    }
  },

  /** Recalcula todos los circuitos del snapshot actual. */
  calcularTodos(circuitos, equipos, normativaId) {
    const id = normativaId ?? DataProvider.getNormativaActivaId();
    return (circuitos || DataProvider.getCircuitos()).map((c) => {
      const eqs = (equipos || DataProvider.getEquipos()).filter(
        (e) => e.circuitoId === c.id
      );
      return this.calcularCircuito(c, eqs, id);
    });
  },

  // --- Exposición controlada de primitivas (sin saltarse el mediador) ---
  corriente: calcularCorriente,
  potenciaDesdeCorriente,
  caidaTension: calcularCaidaTension,
  seleccionarBreaker,
  combinarCargas,
  cargasDemanda: calcularCargasDemanda,
  llenadoConducto: calcularLlenadoConducto,
  cortocircuitoTrifasico: calcularCortocircuitoTrifasico,
  cortocircuitoMonofasico: calcularCortocircuitoMonofasico,
  verificarCapacidadInterrupcion,
};
