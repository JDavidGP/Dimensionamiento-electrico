/**
 * DiagramaMediator
 * Responsabilidad: dominio Diagrama — modelo de nodos/conexiones del
 * diagrama unifilar. Fase 1 ("Motor de datos" + cardinalidad) y Fase 2
 * (motor de reglas eléctricas semántico, ver modules/diagrama/reglas.js)
 * de la spec del usuario (2026-11-20) ya están construidas. Autoorganización
 * (modules/diagrama/autoorganizar.js) y zoom/pan (modules/geometria/
 * vistaZoomPan.js, mismo núcleo compartido que ya usa Plano) agregados
 * después, mismo día, segundo pedido de una lista: PDF embebido (ya
 * hecho) → esto → escaneo por cámara/foto → coordenadas por texto en
 * el plano.
 *
 * Mismo criterio que TableroMediator/OrigenMediator: NO muta el
 * proyecto. Devuelve datos ya calculados/transformados; la escritura
 * real la hace la capa de aplicación (hook).
 *
 * Dependencias permitidas: funciones internas de modules/diagrama,
 * modules/geometria/ (núcleo compartido, permitido a nivel mediador —
 * mismo patrón que PlanoMediator → modules/geometria/, ver
 * ARCHITECTURE.md §11), DataProvider. Lo que sigue prohibido: UI, Documento.
 */
import {
  crearNodo,
  editarNodo,
  crearConexion,
  editarConexion,
  eliminarConexionesDeNodo,
  liberarNodosDeEntidad,
  validarConexion,
  validarReglaElectrica,
  autoorganizarNodos,
  elegirSimboloEquipo,
} from "../../modules/diagrama/index.ts";
import {
  transformVistaInicial,
  aPantalla,
  aModelo,
  aplicarZoom,
  aplicarPan,
  ajustarAVentana,
  ZOOM_MIN,
  ZOOM_MAX,
} from "../../modules/geometria/index.ts";
import { CATALOGO_COMPONENTES, CATEGORIAS_COMPONENTE, obtenerComponente, componentesPorCategoriaDiagrama } from "../../shared/data/bibliotecaComponentes.ts";
import { DataProvider } from "../services/DataProvider.ts";
import type { Tablero, FuenteEnergia, Transformador } from "../services/DataProvider.ts";
import { Logger } from "../services/Logger.ts";
import { OrigenMediator } from "./OrigenMediator.ts";
import type { NodoDiagrama, ConexionDiagrama, DatosNodo, DatosConexion } from "../../modules/diagrama/tipos.ts";
import type { Equipo } from "../../modules/validacion/tipos.ts";

export const DiagramaMediator = {
  // Catálogo expuesto para la UI — mismo patrón que OrigenMediator con sus enums.
  CATALOGO_COMPONENTES,
  CATEGORIAS_COMPONENTE,
  obtenerComponente,
  // "soloPlano" (ej. caja de empalme) no es seleccionable acá —
  // ver componentesPorCategoriaDiagrama en bibliotecaComponentes.js.
  componentesPorCategoria: componentesPorCategoriaDiagrama,
  ZOOM_MIN,
  ZOOM_MAX,

  /** Posiciones nuevas (nodoId -> {x,y}) que acomodan el diagrama en capas según el sentido de las conexiones — el hook decide cómo aplicarlas. */
  autoorganizar(nodos?: Parameters<typeof autoorganizarNodos>[0], conexiones?: Parameters<typeof autoorganizarNodos>[1], opciones?: Parameters<typeof autoorganizarNodos>[2]) {
    return autoorganizarNodos(nodos ?? [], conexiones ?? [], opciones);
  },

  /** Símbolo del catálogo que mejor representa a un equipo, por palabras clave en su nombre/función (ver seleccionSimbolo.ts) — nunca certero, cae a "carga_especial" ante la duda. */
  elegirSimboloEquipo(equipo: Parameters<typeof elegirSimboloEquipo>[0]) {
    return elegirSimboloEquipo(equipo);
  },

  // Vista (zoom/pan) — matemática pura de modules/geometria/, mismo
  // núcleo que ya usa PlanoMediator, nunca efímera/con estado acá.
  transformVistaInicial,
  aPantalla,
  aModelo,
  aplicarZoom,
  aplicarPan,
  ajustarAVentana,

  /** Fábrica de un nodo nuevo (no lo guarda — eso lo hace el hook). */
  crearNodo(datos: DatosNodo) {
    return crearNodo(datos);
  },

  /** Devuelve el nodo editado; el hook decide cómo guardarlo. */
  editarNodo(nodo: NodoDiagrama, cambios: DatosNodo) {
    return editarNodo(nodo, cambios);
  },

  /** Conexiones que quedan tras eliminar un nodo (las suyas se eliminan, no quedan rotas). */
  conexionesTrasEliminarNodo(nodoId: string, conexiones?: ConexionDiagrama[]) {
    return eliminarConexionesDeNodo(nodoId, conexiones ?? []);
  },

  /** Fábrica de una conexión nueva, validada contra cardinalidad antes de crearla. */
  crearConexionValidada(datos: DatosConexion & { nodoOrigenId: string; nodoDestinoId: string }, nodos?: NodoDiagrama[], conexionesExistentes?: ConexionDiagrama[]) {
    const validacion = validarConexion(datos, nodos ?? [], conexionesExistentes ?? []);
    if (!validacion.valido) {
      Logger.warn("DiagramaMediator.crearConexionValidada: conexión rechazada", { motivo: validacion.motivo });
      return { ok: false as const, motivo: validacion.motivo };
    }
    return { ok: true as const, conexion: crearConexion(datos) };
  },

  /** Devuelve la conexión editada; el hook decide cómo guardarla. */
  editarConexion(conexion: ConexionDiagrama, cambios: DatosConexion) {
    return editarConexion(conexion, cambios);
  },

  validarConexion(conexionPropuesta: { nodoOrigenId: string; nodoDestinoId: string }, nodos?: NodoDiagrama[], conexionesExistentes?: ConexionDiagrama[]) {
    return validarConexion(conexionPropuesta, nodos ?? DataProvider.getNodosDiagrama(), conexionesExistentes ?? DataProvider.getConexionesDiagrama());
  },

  /** Solo la compatibilidad semántica tipo→tipo (sin cardinalidad ni existencia de nodos) — útil para la UI, ej. resaltar destinos válidos antes de arrastrar una conexión. */
  validarReglaElectrica(tipoOrigen: string, tipoDestino: string) {
    return validarReglaElectrica(tipoOrigen, tipoDestino);
  },

  // --- Sincronización con el modelo canónico (ARCHITECTURE.md §9) ---
  // El diagrama es una VISTA sobre circuitos/equipos/tableros/
  // fuentesEnergia, no una copia paralela. Estos métodos son el único
  // lugar donde el dominio Diagrama cruza hacia otros dominios (tablero/
  // equipo/fuenteEnergia) — permitido a nivel mediador (ver ARCHITECTURE.md
  // §11), nunca a nivel módulo puro.

  /**
   * Entidades candidatas para vincular a un nodo de tipo `tipoNodo` —
   * solo las del tipo correcto (según `entidadVinculada` del catálogo,
   * y además filtradas por TIPOS_FUENTE_ENERGIA cuando el tipo de nodo
   * es "generador" o "banco_baterias") y que ningún OTRO nodo ya tenga
   * vinculadas (relación 1 a 1 nodo↔entidad — evita dibujar el mismo
   * tablero/equipo/fuente dos veces). `nodoId` excluye al propio nodo
   * de esa exclusión cuando se está reeditando su vínculo.
   */
  candidatosEntidad(
    tipoNodo: string,
    { tableros = [], equipos = [], fuentesEnergia = [], transformadores = [], nodos = [], nodoId = null }: { tableros?: Tablero[]; equipos?: Equipo[]; fuentesEnergia?: FuenteEnergia[]; transformadores?: Transformador[]; nodos?: NodoDiagrama[]; nodoId?: string | null } = {}
  ) {
    const comp = obtenerComponente(tipoNodo);
    if (!comp?.entidadVinculada) return [];
    const vinculados = new Set(nodos.filter((n) => n.id !== nodoId && n.entidadId).map((n) => n.entidadId));

    if (comp.entidadVinculada === "tablero") {
      return tableros.filter((t) => !vinculados.has(t.id));
    }
    if (comp.entidadVinculada === "equipo") {
      return equipos.filter((e) => !vinculados.has(e.id));
    }
    if (comp.entidadVinculada === "fuenteEnergia") {
      const { GENERADOR, BATERIA } = OrigenMediator.TIPOS_FUENTE_ENERGIA;
      const tipoFuente = tipoNodo === "generador" ? GENERADOR : tipoNodo === "banco_baterias" ? BATERIA : null;
      return fuentesEnergia.filter((f) => (!tipoFuente || f.tipo === tipoFuente) && !vinculados.has(f.id));
    }
    if (comp.entidadVinculada === "transformador") {
      return transformadores.filter((t) => !vinculados.has(t.id));
    }
    return [];
  },

  /** La entidad real (tablero/equipo/fuenteEnergia/transformador) que representa este nodo, o null si no tiene vínculo o la entidad ya no existe. */
  resolverEntidad(
    nodo: NodoDiagrama | null | undefined,
    { tableros = [], equipos = [], fuentesEnergia = [], transformadores = [] }: { tableros?: Tablero[]; equipos?: Equipo[]; fuentesEnergia?: FuenteEnergia[]; transformadores?: Transformador[] } = {}
  ) {
    if (!nodo?.entidadId) return null;
    const comp = obtenerComponente(nodo.tipo);
    if (comp?.entidadVinculada === "tablero") return tableros.find((t) => t.id === nodo.entidadId) ?? null;
    if (comp?.entidadVinculada === "equipo") return equipos.find((e) => e.id === nodo.entidadId) ?? null;
    if (comp?.entidadVinculada === "fuenteEnergia") return fuentesEnergia.find((f) => f.id === nodo.entidadId) ?? null;
    if (comp?.entidadVinculada === "transformador") return transformadores.find((t) => t.id === nodo.entidadId) ?? null;
    return null;
  },

  /** Nodos tras liberar (desvincular, no borrar) los que apuntaban a una entidad eliminada. */
  liberarNodosDeEntidad(entidadId: string, nodos?: NodoDiagrama[]) {
    return liberarNodosDeEntidad(entidadId, nodos ?? []);
  },
};
