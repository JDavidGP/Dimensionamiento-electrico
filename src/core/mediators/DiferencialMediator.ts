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
  requiereDiferencialREBT,
  SENSIBILIDAD_MAXIMA_DIFERENCIAL_GENERAL_MA,
} from "../../modules/diferencial/index.ts";
import { DataProvider } from "../services/DataProvider.ts";
import { Logger } from "../services/Logger.ts";
import type { Circuito } from "../../modules/validacion/tipos.ts";

export const DiferencialMediator = {
  /** ITC-BT-25: máximo de circuitos por diferencial, expuesto para la UI y la validación (ver modules/validacion/referencial.ts). */
  MAX_CIRCUITOS_POR_DIFERENCIAL,
  SENSIBILIDAD_MAXIMA_DIFERENCIAL_GENERAL_MA,

  /** ¿Le falta un diferencial a este circuito? (ITC-BT-25 §2.1 — todos los circuitos, sin excepción). El llamador gatea esto a IEC_ES. */
  requiereDiferencial(circuito: Parameters<typeof requiereDiferencialREBT>[0]) {
    return requiereDiferencialREBT(circuito);
  },

  crear(datos: Parameters<typeof crearDiferencial>[0]) {
    return crearDiferencial(datos);
  },

  editar(diferencial: Parameters<typeof editarDiferencial>[0], cambios: Parameters<typeof editarDiferencial>[1]) {
    return editarDiferencial(diferencial, cambios);
  },

  listar() {
    return DataProvider.getDiferenciales();
  },

  obtener(id: string) {
    return DataProvider.getDiferencial(id);
  },

  /** Circuitos que pertenecen a un diferencial (lectura calculada, no una segunda copia). */
  circuitosDe(diferencialId: Parameters<typeof circuitosDeDiferencial>[0], circuitos?: Parameters<typeof circuitosDeDiferencial>[1]) {
    return circuitosDeDiferencial(diferencialId, circuitos ?? DataProvider.getCircuitos());
  },

  /**
   * Devuelve el circuito actualizado; el hook decide cómo guardarlo.
   * Genérico explícito en <C> (no `Parameters<typeof asignarCircuitoADiferencial>[0]`,
   * que colapsaría al constraint `ConDiferencialId` y perdería el tipo
   * real del circuito) — mismo criterio que TableroMediator.asignar.
   */
  asignar<C extends Parameters<typeof asignarCircuitoADiferencial>[0]>(circuito: C, diferencialId: Parameters<typeof asignarCircuitoADiferencial>[1]) {
    if (diferencialId && !DataProvider.getDiferencial(diferencialId)) {
      Logger.warn("DiferencialMediator.asignar: diferencialId no existe", { diferencialId });
    }
    return asignarCircuitoADiferencial(circuito, diferencialId);
  },

  /** Al borrar un diferencial, libera (no borra) los circuitos que le pertenecían. */
  liberarCircuitos(diferencialId: string, circuitos?: Circuito[]) {
    return liberarCircuitosDeDiferencial(diferencialId, circuitos ?? DataProvider.getCircuitos());
  },
};
