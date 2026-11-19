/**
 * Módulo Validación — API interna.
 * La UI no importa esto directamente; usa ValidacionMediator.
 */
export {
  validarIntegridadReferencial,
  ESTADOS as ESTADOS_REFERENCIAL,
  peorEstado,
} from "./referencial.js";
export {
  validarIntegridadElectrica,
  ESTADOS as ESTADOS_ELECTRICA,
  localizarNodo,
} from "./electrica.js";
export {
  validarCircuito,
  formularioACircuito,
  circuitoAFormulario,
  validarEquipo,
  formularioAEquipo,
  equipoAFormulario,
} from "./formularios.js";

import { validarIntegridadReferencial, ESTADOS } from "./referencial.js";
import { validarIntegridadElectrica } from "./electrica.js";

export function obtenerListaIntegridad(proyecto, circuitos = [], equipos = [], tableros = [], fuentesEnergia = [], nodosDiagrama = [], transformadores = []) {
  return validarIntegridadReferencial(proyecto, circuitos, equipos, tableros, fuentesEnergia, nodosDiagrama, transformadores);
}

export function obtenerDetalleElectrico(id, proyecto, circuitos = [], equipos = [], opts = {}) {
  return validarIntegridadElectrica(id, proyecto, circuitos, equipos, opts);
}

export function resumenIntegridad(proyecto, circuitos = [], equipos = [], tableros = [], fuentesEnergia = [], nodosDiagrama = [], transformadores = []) {
  const lista = validarIntegridadReferencial(proyecto, circuitos, equipos, tableros, fuentesEnergia, nodosDiagrama, transformadores);
  return lista.reduce(
    (acc, entrada) => {
      acc[entrada.estado] = (acc[entrada.estado] || 0) + 1;
      return acc;
    },
    { ok: 0, advertencia: 0, error: 0 }
  );
}

export { ESTADOS };
