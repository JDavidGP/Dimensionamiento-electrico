/**
 * PersistenciaMediator
 * Módulos: exportador JSON (actual), SQLite / importador PDF (futuro).
 */
import {
  proyectoVacio,
  planoVacio,
  serializarProyecto,
  deserializarProyecto,
  nombreArchivo,
} from "../../modules/persistencia/index.ts";
import { Logger } from "../services/Logger.js";
import { Config } from "../services/Config.js";

export const PersistenciaMediator = {
  proyectoVacio,
  planoVacio,
  nombreArchivo,

  serializar({ proyecto, normativaActiva, tipoInstalacion, circuitos, equipos, tableros, fuentesEnergia, transformadores, nodosDiagrama, conexionesDiagrama, plano }) {
    const data = serializarProyecto({
      proyecto,
      normativaActiva,
      tipoInstalacion,
      circuitos,
      equipos,
      tableros,
      fuentesEnergia,
      transformadores,
      nodosDiagrama,
      conexionesDiagrama,
      plano,
    });
    data.formatoVersion = data.formatoVersion ?? Config.formatoVersion;
    return data;
  },

  deserializar(data) {
    try {
      return deserializarProyecto(data);
    } catch (err) {
      Logger.error("PersistenciaMediator.deserializar", err);
      throw err;
    }
  },

  /** Descarga el proyecto como archivo .json en el navegador. */
  descargarJson({ proyecto, normativaActiva, tipoInstalacion, circuitos, equipos, tableros, fuentesEnergia, transformadores, nodosDiagrama, conexionesDiagrama, plano }) {
    const datos = this.serializar({
      proyecto,
      normativaActiva,
      tipoInstalacion,
      circuitos,
      equipos,
      tableros,
      fuentesEnergia,
      transformadores,
      nodosDiagrama,
      conexionesDiagrama,
      plano,
    });
    const blob = new Blob([JSON.stringify(datos, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo(proyecto);
    a.click();
    URL.revokeObjectURL(url);
    return nombreArchivo(proyecto);
  },

  /** Lee un File del input y deserializa. */
  abrirDesdeArchivo(archivo) {
    return new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = (e) => {
        try {
          const cargado = this.deserializar(JSON.parse(e.target.result));
          resolve(cargado);
        } catch (err) {
          reject(err);
        }
      };
      lector.onerror = () => reject(new Error("No se pudo leer el archivo."));
      lector.readAsText(archivo);
    });
  },
};
