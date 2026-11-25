/**
 * MotorCalculoMediator
 * Coordina cálculos eléctricos.
 * Dependencias permitidas: DataProvider, NormativaMediator, funciones internas del motor.
 * NO depende de: UI, documentos, diagramas.
 */
import { calcularCircuito as calcInterno } from "../../modules/motor/calcularCircuito.ts";
import {
  calcularCorriente,
  potenciaDesdeCorriente,
  calcularCaidaTension,
  evaluarCaidaAcumulada,
  seleccionarBreaker,
  combinarCargas,
  calcularCargasDemanda,
  calcularLlenadoConducto,
  diametroMinimoTuboREBT,
  factorAjusteConductoresPortadoresNEC,
  conductoresPortadoresCorriente,
  profundidadMinimaEnterradoNEC,
  profundidadMinimaEnterradaREBT,
  separacionMinimaOtrasCanalizacionesREBT,
  factorAgrupacionTubosREBT,
  separacionABucket,
  calcularCortocircuitoTrifasico,
  calcularCortocircuitoMonofasico,
  verificarCapacidadInterrupcion,
  balanceFases,
  normalizarTransformador,
  calcularCorrientesNominales,
  coeficienteSimultaneidad,
  GRADOS_ELECTRIFICACION,
  calcularCargaSimultaneaViviendas,
} from "../../modules/motor/index.ts";
import { NormativaMediator } from "./NormativaMediator.js";
import { DataProvider } from "../services/DataProvider.js";
import { Logger } from "../services/Logger.js";

export const MotorCalculoMediator = {
  /**
   * Dimensiona un circuito. Resuelve la normativa vía NormativaMediator
   * e inyecta el objeto al motor puro.
   *
   * `contextoInstalacion` (usuario, 2026-11-21, REBT ITC-BT-19 §2.2.2):
   * { tipoInstalacion, tieneTransformadorPropio } — lo que el motor
   * puro necesita para el límite de caída de tensión de REBT, opcional
   * y pasado tal cual a calcInterno (que ya lo ignora por su cuenta si
   * la normativa no lo usa). El llamador (hook) lo arma por circuito
   * vía TableroMediator.tieneTransformadorPropio — este mediador no
   * conoce tableros, solo reenvía lo que le dan.
   */
  calcularCircuito(circuito, equipos, normativaId, contextoInstalacion) {
    const id = normativaId ?? DataProvider.getNormativaActivaId();
    const normativa = NormativaMediator.obtener(id);
    try {
      return calcInterno(circuito, equipos, normativa, contextoInstalacion);
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

  /**
   * Recalcula todos los circuitos del snapshot actual.
   * `contextoPorCircuitoId`: Record<circuitoId, ContextoInstalacionCircuito>
   * opcional — ver calcularCircuito. Sin este parámetro, comportamiento
   * idéntico a siempre (cada circuito usa `{}` por defecto en el motor).
   */
  calcularTodos(circuitos, equipos, normativaId, contextoPorCircuitoId) {
    const id = normativaId ?? DataProvider.getNormativaActivaId();
    return (circuitos || DataProvider.getCircuitos()).map((c) => {
      const eqs = (equipos || DataProvider.getEquipos()).filter(
        (e) => e.circuitoId === c.id
      );
      return this.calcularCircuito(c, eqs, id, contextoPorCircuitoId?.[c.id]);
    });
  },

  // --- Exposición controlada de primitivas (sin saltarse el mediador) ---
  corriente: calcularCorriente,
  potenciaDesdeCorriente,
  caidaTension: calcularCaidaTension,
  caidaAcumulada: evaluarCaidaAcumulada,
  seleccionarBreaker,
  combinarCargas,
  cargasDemanda: calcularCargasDemanda,
  llenadoConducto: calcularLlenadoConducto,
  // Diámetro mínimo de tubo REBT (ITC-BT-21) — expuesto en el mismo
  // nivel que llenadoConducto (NEC): creado y probado, ningún hook ni
  // componente lo llama todavía. Método distinto a NEC (tabla directa
  // por sección+cantidad, no % de área) — ver canalizacionREBT.ts.
  diametroTuboREBT: diametroMinimoTuboREBT,
  // Instalación enterrada/agrupamiento (usuario, 2026-11-25, "canalizaciones
  // aéreas y subterráneas") — mismo nivel que diametroTuboREBT arriba.
  factorAjusteCCCNec: factorAjusteConductoresPortadoresNEC,
  conductoresPortadoresCorriente,
  profundidadMinimaEnterradoNEC,
  profundidadMinimaEnterradaREBT,
  separacionMinimaOtrasCanalizacionesREBT,
  factorAgrupacionTubosREBT,
  separacionABucket,
  cortocircuitoTrifasico: calcularCortocircuitoTrifasico,
  cortocircuitoMonofasico: calcularCortocircuitoMonofasico,
  verificarCapacidadInterrupcion,
  balanceFases,
  // Transformador: expuesto en el mismo nivel que llenadoConducto y
  // cortocircuito (creado, no conectado — ningún hook ni componente
  // llama esto todavía; ver modules/motor/transformador.js).
  normalizarTransformador,
  corrientesNominalesTransformador: calcularCorrientesNominales,
  // Simultaneidad REBT ITC-BT-10 — expuesto para la UI (selector de
  // grado de electrificación, previsualización del coeficiente) y para
  // tests; el cálculo real al armar el alimentador agregado vive en
  // TableroMediator.calcularAlimentadorAgregado.
  coeficienteSimultaneidad,
  GRADOS_ELECTRIFICACION,
  calcularCargaSimultaneaViviendas,
};
