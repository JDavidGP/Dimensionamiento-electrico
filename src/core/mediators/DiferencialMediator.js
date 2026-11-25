/**
 * DiferencialMediator
 * Responsabilidad: dominio Diferencial (ID) — dato relacional puro,
 * REBT ITC-BT-25 (agrupa hasta MAX_CIRCUITOS_POR_DIFERENCIAL circuitos).
 * Mismo criterio que TableroMediator: NO muta el proyecto, devuelve
 * datos ya transformados; la escritura real (setCircuitos/
 * setDiferenciales) la hace la capa de aplicación (hook).
 */
import {
  crearDiferencial,
  editarDiferencial,
  circuitosDeDiferencial,
  asignarCircuitoADiferencial,
  liberarCircuitosDeDiferencial,
  MAX_CIRCUITOS_POR_DIFERENCIAL,
} from "../../modules/diferencial/index.ts";
import { DataProvider } from "../services/DataProvider.js";
import { Logger } from "../services/Logger.js";

export const DiferencialMediator = {
  /** ITC-BT-25: máximo de circuitos por diferencial, expuesto para la UI y la validación (ver modules/validacion/referencial.ts). */
  MAX_CIRCUITOS_POR_DIFERENCIAL,

  crear(datos) {
    return crearDiferencial(datos);
  },

  editar(diferencial, cambios) {
    return editarDiferencial(diferencial, cambios);
  },

  listar() {
    return DataProvider.getDiferenciales();
  },

  obtener(id) {
    return DataProvider.getDiferencial(id);
  },

  /** Circuitos que pertenecen a un diferencial (lectura calculada, no una segunda copia). */
  circuitosDe(diferencialId, circuitos) {
    return circuitosDeDiferencial(diferencialId, circuitos ?? DataProvider.getCircuitos());
  },

  /** Devuelve el circuito actualizado; el hook decide cómo guardarlo. */
  asignar(circuito, diferencialId) {
    if (diferencialId && !DataProvider.getDiferencial(diferencialId)) {
      Logger.warn("DiferencialMediator.asignar: diferencialId no existe", { diferencialId });
    }
    return asignarCircuitoADiferencial(circuito, diferencialId);
  },

  /** Al borrar un diferencial, libera (no borra) los circuitos que le pertenecían. */
  liberarCircuitos(diferencialId, circuitos) {
    return liberarCircuitosDeDiferencial(diferencialId, circuitos ?? DataProvider.getCircuitos());
  },
};
