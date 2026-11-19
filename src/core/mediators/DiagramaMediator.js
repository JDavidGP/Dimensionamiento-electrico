/**
 * DiagramaMediator
 * Responsabilidad: dominio Diagrama — modelo de nodos/conexiones del
 * diagrama unifilar (Fase 1 de la spec del usuario, 2026-11-20: "Motor
 * de datos" + validación de cardinalidad básica del "Motor de reglas
 * eléctricas"). Motor de dibujo, autoorganización y editor visual
 * quedan para una próxima ronda — ver modules/diagrama/index.js para
 * el detalle completo de alcance.
 *
 * Mismo criterio que TableroMediator/OrigenMediator: NO muta el
 * proyecto. Devuelve datos ya calculados/transformados; la escritura
 * real la hace la capa de aplicación (hook).
 *
 * Dependencias permitidas: funciones internas de modules/diagrama,
 * DataProvider. Lo que sigue prohibido: UI, Documento.
 */
import {
  crearNodo,
  editarNodo,
  crearConexion,
  editarConexion,
  eliminarConexionesDeNodo,
  validarConexion,
} from "../../modules/diagrama/index.js";
import { CATALOGO_COMPONENTES, CATEGORIAS_COMPONENTE, obtenerComponente, componentesPorCategoria } from "../../shared/data/bibliotecaComponentes.js";
import { DataProvider } from "../services/DataProvider.js";
import { Logger } from "../services/Logger.js";

export const DiagramaMediator = {
  // Catálogo expuesto para la UI — mismo patrón que OrigenMediator con sus enums.
  CATALOGO_COMPONENTES,
  CATEGORIAS_COMPONENTE,
  obtenerComponente,
  componentesPorCategoria,

  /** Fábrica de un nodo nuevo (no lo guarda — eso lo hace el hook). */
  crearNodo(datos) {
    return crearNodo(datos);
  },

  /** Devuelve el nodo editado; el hook decide cómo guardarlo. */
  editarNodo(nodo, cambios) {
    return editarNodo(nodo, cambios);
  },

  /** Conexiones que quedan tras eliminar un nodo (las suyas se eliminan, no quedan rotas). */
  conexionesTrasEliminarNodo(nodoId, conexiones) {
    return eliminarConexionesDeNodo(nodoId, conexiones ?? []);
  },

  /** Fábrica de una conexión nueva, validada contra cardinalidad antes de crearla. */
  crearConexionValidada(datos, nodos, conexionesExistentes) {
    const validacion = validarConexion(datos, nodos ?? [], conexionesExistentes ?? []);
    if (!validacion.valido) {
      Logger.warn("DiagramaMediator.crearConexionValidada: conexión rechazada", { motivo: validacion.motivo });
      return { ok: false, motivo: validacion.motivo };
    }
    return { ok: true, conexion: crearConexion(datos) };
  },

  /** Devuelve la conexión editada; el hook decide cómo guardarla. */
  editarConexion(conexion, cambios) {
    return editarConexion(conexion, cambios);
  },

  validarConexion(conexionPropuesta, nodos, conexionesExistentes) {
    return validarConexion(conexionPropuesta, nodos ?? DataProvider.getNodosDiagrama(), conexionesExistentes ?? DataProvider.getConexionesDiagrama());
  },
};
