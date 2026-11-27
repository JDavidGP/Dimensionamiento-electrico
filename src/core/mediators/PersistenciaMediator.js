/**
 * PersistenciaMediator
 * Guardar/abrir proyecto como .pdf (con los datos incrustados) — el
 * formato por defecto desde 2026-11-22, pedido explícito del usuario
 * ("quiero que el empaquetado... guarde en PDF en vez de json"); .json
 * sigue pudiéndose ABRIR (nunca se deja de poder reabrir un proyecto
 * guardado antes de este cambio) pero ya no es la opción de guardado
 * que ofrece la UI. Ver modules/persistencia/pdf.ts para el porqué
 * completo (adjunto binario, no "leer los números impresos").
 */
import {
  proyectoVacio,
  planoVacio,
  serializarProyecto,
  deserializarProyecto,
  nombreArchivo,
} from "../../modules/persistencia/index.ts";
import { generarPdfProyecto, extraerDatosDePdf } from "../../modules/persistencia/pdf.ts";
import { OPCIONES_TIPO_INSTALACION } from "../../shared/constants/constantes.ts";
import { Logger } from "../services/Logger.js";
import { Config } from "../services/Config.js";

export const PersistenciaMediator = {
  proyectoVacio,
  planoVacio,
  nombreArchivo,

  serializar({ proyecto, normativaActiva, tipoInstalacion, circuitos, equipos, tableros, fuentesEnergia, transformadores, diferenciales, nodosDiagrama, conexionesDiagrama, plano }) {
    const data = serializarProyecto({
      proyecto,
      normativaActiva,
      tipoInstalacion,
      circuitos,
      equipos,
      tableros,
      fuentesEnergia,
      transformadores,
      diferenciales,
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
  descargarJson({ proyecto, normativaActiva, tipoInstalacion, circuitos, equipos, tableros, fuentesEnergia, transformadores, diferenciales, nodosDiagrama, conexionesDiagrama, plano }) {
    const datos = this.serializar({
      proyecto,
      normativaActiva,
      tipoInstalacion,
      circuitos,
      equipos,
      tableros,
      fuentesEnergia,
      transformadores,
      diferenciales,
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

  /** Descarga el proyecto como archivo .pdf (ficha legible + datos completos incrustados). */
  async descargarPdf({ proyecto, normativaActiva, tipoInstalacion, circuitos, equipos, tableros, fuentesEnergia, transformadores, diferenciales, nodosDiagrama, conexionesDiagrama, plano }) {
    const datos = this.serializar({
      proyecto,
      normativaActiva,
      tipoInstalacion,
      circuitos,
      equipos,
      tableros,
      fuentesEnergia,
      transformadores,
      diferenciales,
      nodosDiagrama,
      conexionesDiagrama,
      plano,
    });
    const labelTipoInstalacion = OPCIONES_TIPO_INSTALACION.find((o) => o.valor === datos.tipoInstalacion)?.label ?? datos.tipoInstalacion;
    const pdfBytes = await generarPdfProyecto(datos, {
      tituloFicha: datos.proyecto?.nombre || "Proyecto sin nombre",
      lineasFicha: [
        `Normativa: ${datos.normativaActiva} · Tipo de instalación: ${labelTipoInstalacion}`,
        `Tableros: ${datos.tableros.length} · Circuitos: ${datos.circuitos.length} · Equipos: ${datos.equipos.length}`,
        `Guardado: ${new Date().toLocaleString()}`,
      ],
    });
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo(proyecto, "pdf");
    a.click();
    URL.revokeObjectURL(url);
    return nombreArchivo(proyecto, "pdf");
  },

  /** Lee un File del input (.pdf o, por compatibilidad, .json de versiones anteriores) y deserializa. */
  abrirDesdeArchivo(archivo) {
    const esPdf = archivo.type === "application/pdf" || /\.pdf$/i.test(archivo.name || "");
    if (esPdf) return this.abrirDesdeArchivoPdf(archivo);

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

  abrirDesdeArchivoPdf(archivo) {
    return new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = async (e) => {
        try {
          const datos = await extraerDatosDePdf(e.target.result);
          resolve(this.deserializar(datos));
        } catch (err) {
          reject(err);
        }
      };
      lector.onerror = () => reject(new Error("No se pudo leer el archivo."));
      lector.readAsArrayBuffer(archivo);
    });
  },
};
