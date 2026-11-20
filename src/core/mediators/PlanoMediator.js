/**
 * PlanoMediator
 * Responsabilidad: dominio Plano — calibración de escala, grafo de
 * nodos/segmentos (paredes) en metros reales, habitaciones derivadas,
 * y las transformaciones de vista (zoom/pan) puramente matemáticas.
 * Ver PLANO_INTELIGENTE_DISENO.md para el porqué completo de esta
 * separación (independencia de dispositivo/resolución/DPI).
 *
 * Cruza hacia modules/geometria/ (núcleo compartido) — permitido a
 * nivel mediador, mismo patrón que OrigenMediator → modules/motor/
 * transformador.js (ver ARCHITECTURE.md §11).
 *
 * NO muta el proyecto — solo fábricas/cálculos puros; la escritura
 * real la hace la capa de aplicación (hook), igual criterio que el
 * resto de los mediadores de dominio. NUNCA depende de `window`,
 * `devicePixelRatio` ni del DOM — eso es responsabilidad exclusiva del
 * componente de render (PlanoCanvas.jsx).
 */
import {
  crearNodo,
  nodoCercano,
  crearSegmento,
  eliminarNodo,
  eliminarSegmento,
  crearHabitacion,
  crearHabitacionRectangular,
  moverNodos,
  crearRutaConductor,
  eliminarRutaConductor,
  crearMarcadorEquipo,
  editarMarcadorEquipo,
  eliminarMarcadorEquipo,
  liberarMarcadoresDeEntidad,
  calcularEscala,
  imagenAModelo,
  modeloAImagen,
  transformVistaInicial,
  aPantalla,
  aModelo,
  aplicarZoom,
  aplicarPan,
  ajustarAVentana,
  RADIO_SNAP_METROS,
  ZOOM_MIN,
  ZOOM_MAX,
  pixelBordeMasFuerte,
  RADIO_BUSQUEDA_BORDE_PX,
  UMBRAL_MAGNITUD_BORDE,
  calcularHomografia,
  aplicarHomografia,
  invertirMatriz3x3,
  generarDXF,
  codificarDXFComoBytes,
} from "../../modules/plano/index.js";
import { distancia, areaPoligono, perimetroPoligono, puntoDentroDePoligono } from "../../modules/geometria/index.js";
import { CATALOGO_COMPONENTES, CATEGORIAS_COMPONENTE, obtenerComponente, componentesPorCategoria } from "../../shared/data/bibliotecaComponentes.js";
import { OrigenMediator } from "./OrigenMediator.js";

export const PlanoMediator = {
  RADIO_SNAP_METROS,
  ZOOM_MIN,
  ZOOM_MAX,
  RADIO_BUSQUEDA_BORDE_PX,
  UMBRAL_MAGNITUD_BORDE,
  pixelBordeMasFuerte,

  crearNodo,
  nodoCercano,
  crearSegmento,
  eliminarNodo,
  eliminarSegmento,
  crearHabitacion,
  crearHabitacionRectangular,
  moverNodos,
  crearRutaConductor,
  eliminarRutaConductor,

  calcularEscala,
  imagenAModelo,
  modeloAImagen,

  transformVistaInicial,
  aPantalla,
  aModelo,
  aplicarZoom,
  aplicarPan,
  ajustarAVentana,

  distancia,
  areaPoligono,
  perimetroPoligono,
  puntoDentroDePoligono,

  calcularHomografia,
  aplicarHomografia,
  invertirMatriz3x3,

  generarDXF,
  codificarDXFComoBytes,

  // Catálogo de tipos de equipo — EL MISMO que usa el diagrama unifilar
  // (shared/data/bibliotecaComponentes.js), nunca un segundo catálogo
  // paralelo para los marcadores del plano.
  CATALOGO_COMPONENTES,
  CATEGORIAS_COMPONENTE,
  obtenerComponente,
  componentesPorCategoria,

  crearMarcadorEquipo,
  editarMarcadorEquipo,
  eliminarMarcadorEquipo,
  liberarMarcadoresDeEntidad,

  /**
   * Entidades candidatas para vincular a un marcador de este `tipo`, en
   * el plano — EXCLUSIÓN PROPIA del plano, NO cruza con los vínculos
   * que ya tenga el diagrama unifilar (ver nota de arquitectura en
   * modules/plano/index.js): la misma entidad puede estar vinculada a
   * un nodo del diagrama Y a un marcador del plano a la vez, son
   * aspectos distintos (topología eléctrica vs. ubicación física).
   */
  candidatosEntidadEquipo(tipoEquipo, { tableros = [], equipos = [], fuentesEnergia = [], transformadores = [], marcadores = [], marcadorId = null } = {}) {
    const comp = obtenerComponente(tipoEquipo);
    if (!comp?.entidadVinculada) return [];
    const vinculados = new Set(marcadores.filter((m) => m.id !== marcadorId && m.entidadId).map((m) => m.entidadId));

    if (comp.entidadVinculada === "tablero") {
      return tableros.filter((t) => !vinculados.has(t.id));
    }
    if (comp.entidadVinculada === "equipo") {
      return equipos.filter((e) => !vinculados.has(e.id));
    }
    if (comp.entidadVinculada === "fuenteEnergia") {
      const { GENERADOR, BATERIA } = OrigenMediator.TIPOS_FUENTE_ENERGIA;
      const tipoFuente = tipoEquipo === "generador" ? GENERADOR : tipoEquipo === "banco_baterias" ? BATERIA : null;
      return fuentesEnergia.filter((f) => (!tipoFuente || f.tipo === tipoFuente) && !vinculados.has(f.id));
    }
    if (comp.entidadVinculada === "transformador") {
      return transformadores.filter((t) => !vinculados.has(t.id));
    }
    return [];
  },

  /** La entidad real que representa este marcador, o null si no tiene vínculo o ya no existe. */
  resolverEntidadEquipo(marcador, { tableros = [], equipos = [], fuentesEnergia = [], transformadores = [] } = {}) {
    if (!marcador?.entidadId) return null;
    const comp = obtenerComponente(marcador.tipo);
    if (comp?.entidadVinculada === "tablero") return tableros.find((t) => t.id === marcador.entidadId) ?? null;
    if (comp?.entidadVinculada === "equipo") return equipos.find((e) => e.id === marcador.entidadId) ?? null;
    if (comp?.entidadVinculada === "fuenteEnergia") return fuentesEnergia.find((f) => f.id === marcador.entidadId) ?? null;
    if (comp?.entidadVinculada === "transformador") return transformadores.find((t) => t.id === marcador.entidadId) ?? null;
    return null;
  },
};
