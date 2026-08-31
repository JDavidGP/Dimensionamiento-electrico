/**
 * DiagramaMediator — stub.
 * Dependencias: DataProvider.
 */
import { obtenerTopologia } from "../../modules/diagrama/index.js";
import { DataProvider } from "../services/DataProvider.js";
import { Logger } from "../services/Logger.js";

export const DiagramaMediator = {
  topologia(circuitos, equipos) {
    Logger.debug("DiagramaMediator.topologia");
    return obtenerTopologia(
      circuitos ?? DataProvider.getCircuitos(),
      equipos ?? DataProvider.getEquipos()
    );
  },
};
