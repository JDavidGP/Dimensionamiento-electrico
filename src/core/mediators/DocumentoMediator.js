/**
 * DocumentoMediator — stub.
 * Dependencias: DataProvider.
 */
import { generarResumenCalculos, generarMemoriaTecnica } from "../../modules/documento/index.js";
import { DataProvider } from "../services/DataProvider.js";
import { Logger } from "../services/Logger.js";

export const DocumentoMediator = {
  resumenCalculos(resultados) {
    const r = resultados ?? DataProvider.getResultados();
    Logger.debug("DocumentoMediator.resumenCalculos", { n: r.length });
    return generarResumenCalculos(r);
  },

  memoriaTecnica() {
    Logger.warn("DocumentoMediator.memoriaTecnica: stub");
    return generarMemoriaTecnica();
  },
};
