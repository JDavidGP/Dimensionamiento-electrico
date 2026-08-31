/**
 * @deprecated Preferir ApplicationMediator.motor.calcularCircuito
 * Re-export de compatibilidad.
 */
import { MotorCalculoMediator } from "../core/mediators/MotorCalculoMediator.js";

export function calcularCircuito(circuito, equipos, normativaId = "NEC") {
  return MotorCalculoMediator.calcularCircuito(circuito, equipos, normativaId);
}
