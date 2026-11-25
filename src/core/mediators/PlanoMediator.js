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
  editarSegmento,
  eliminarNodo,
  eliminarSegmento,
  crearHabitacion,
  crearHabitacionRectangular,
  habitacionQueContiene,
  moverNodos,
  crearRutaConductor,
  eliminarRutaConductor,
  vincularRutaConductor,
  crearMarcadorEquipo,
  editarMarcadorEquipo,
  eliminarMarcadorEquipo,
  liberarMarcadoresDeEntidad,
  calcularEscala,
  calcularEscalaPorPerimetro,
  imagenAModelo,
  modeloAImagen,
  RADIO_SNAP_METROS,
  pixelBordeMasFuerte,
  RADIO_BUSQUEDA_BORDE_PX,
  UMBRAL_MAGNITUD_BORDE,
  calcularHomografia,
  aplicarHomografia,
  invertirMatriz3x3,
  generarDXF,
  codificarDXFComoBytes,
  detectarParedesCandidatas,
  calcularCrucesPared,
  ANGULO_MINIMO_CRUCE_GRADOS,
  cajaDeHabitacion,
  calcularDeltaConEnganche,
  detectarCaras,
  caminoMasCorto,
} from "../../modules/plano/index.ts";
import {
  distancia,
  areaPoligono,
  perimetroPoligono,
  puntoDentroDePoligono,
  interseccionCirculos,
  transformVistaInicial,
  aPantalla,
  aModelo,
  aplicarZoom,
  aplicarPan,
  ajustarAVentana,
  ZOOM_MIN,
  ZOOM_MAX,
} from "../../modules/geometria/index.ts";
import { CATALOGO_COMPONENTES, CATEGORIAS_COMPONENTE, obtenerComponente, componentesPorCategoria } from "../../shared/data/bibliotecaComponentes.js";
import { OrigenMediator } from "./OrigenMediator.js";

export const PlanoMediator = {
  RADIO_SNAP_METROS,
  ZOOM_MIN,
  ZOOM_MAX,
  RADIO_BUSQUEDA_BORDE_PX,
  UMBRAL_MAGNITUD_BORDE,
  pixelBordeMasFuerte,
  detectarParedesCandidatas,

  crearNodo,
  nodoCercano,
  crearSegmento,
  editarSegmento,
  eliminarNodo,
  eliminarSegmento,
  crearHabitacion,
  crearHabitacionRectangular,
  habitacionQueContiene,
  moverNodos,
  crearRutaConductor,
  eliminarRutaConductor,
  vincularRutaConductor,
  calcularCrucesPared,
  ANGULO_MINIMO_CRUCE_GRADOS,
  cajaDeHabitacion,
  calcularDeltaConEnganche,
  detectarCaras,
  caminoMasCorto,

  /**
   * Circuitos/tableros candidatos para vincular a una ruta de
   * conductor (autocompletar distancia/alimentador) — usuario,
   * 2026-11-22. Mismo criterio de exclusión que candidatosEntidadEquipo:
   * una vez vinculado a UNA ruta, ese circuito/tablero no aparece como
   * candidato en las demás (una distancia, un dueño).
   */
  candidatosEntidadRuta({ circuitos = [], tableros = [], rutas = [], rutaId = null } = {}) {
    const vinculados = new Set(rutas.filter((r) => r.id !== rutaId && r.entidadId).map((r) => r.entidadId));
    return {
      circuitos: circuitos.filter((c) => !vinculados.has(c.id)),
      tableros: tableros.filter((t) => !vinculados.has(t.id)),
    };
  },

  /** La entidad real (circuito o tablero) vinculada a esta ruta, o null si no tiene vínculo o ya no existe. */
  resolverEntidadRuta(ruta, { circuitos = [], tableros = [] } = {}) {
    if (!ruta?.entidadId) return null;
    if (ruta.entidadTipo === "circuito") return circuitos.find((c) => c.id === ruta.entidadId) ?? null;
    if (ruta.entidadTipo === "tablero") return tableros.find((t) => t.id === ruta.entidadId) ?? null;
    return null;
  },

  calcularEscala,
  calcularEscalaPorPerimetro,
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
  interseccionCirculos,

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
  candidatosEntidadEquipo(tipoEquipo, { tableros = [], equipos = [], circuitos = [], fuentesEnergia = [], transformadores = [], marcadores = [], marcadorId = null } = {}) {
    const comp = obtenerComponente(tipoEquipo);
    if (!comp?.entidadVinculada) return [];
    const vinculados = new Set(marcadores.filter((m) => m.id !== marcadorId && m.entidadId).map((m) => m.entidadId));

    if (comp.entidadVinculada === "tablero") {
      return tableros.filter((t) => !vinculados.has(t.id));
    }
    if (comp.entidadVinculada === "equipo") {
      return equipos.filter((e) => !vinculados.has(e.id));
    }
    if (comp.entidadVinculada === "circuito") {
      return circuitos.filter((c) => !vinculados.has(c.id));
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
  resolverEntidadEquipo(marcador, { tableros = [], equipos = [], circuitos = [], fuentesEnergia = [], transformadores = [] } = {}) {
    if (!marcador?.entidadId) return null;
    const comp = obtenerComponente(marcador.tipo);
    if (comp?.entidadVinculada === "tablero") return tableros.find((t) => t.id === marcador.entidadId) ?? null;
    if (comp?.entidadVinculada === "equipo") return equipos.find((e) => e.id === marcador.entidadId) ?? null;
    if (comp?.entidadVinculada === "circuito") return circuitos.find((c) => c.id === marcador.entidadId) ?? null;
    if (comp?.entidadVinculada === "fuenteEnergia") return fuentesEnergia.find((f) => f.id === marcador.entidadId) ?? null;
    if (comp?.entidadVinculada === "transformador") return transformadores.find((t) => t.id === marcador.entidadId) ?? null;
    return null;
  },

  /**
   * Vista combinada "diagrama sobre plano" — usuario, 2026-11-22,
   * "continuemos con diagrama unifilar y planos como dos lienzos
   * separados" + elección explícita "Superponer el diagrama SOBRE el
   * plano". Los modelos de datos NO se fusionan: esto solo resuelve,
   * para cada ConexionDiagrama, el punto físico (en espacio del plano)
   * de sus dos extremos, buscando un MarcadorEquipoPlano que comparta
   * el mismo entidadId que el NodoDiagrama — el mismo mecanismo de
   * vínculo ya usado por candidatosEntidadEquipo/resolverEntidadEquipo,
   * solo que aquí cruza nodos del diagrama con marcadores del plano en
   * vez de marcadores con entidades reales.
   */
  conexionesDiagramaEnPlano({ nodosDiagrama = [], conexionesDiagrama = [], marcadoresEquipoPlano = [] } = {}) {
    const puntoPorNodoId = new Map();
    for (const nodo of nodosDiagrama) {
      if (!nodo.entidadId) continue;
      const marcador = marcadoresEquipoPlano.find((m) => m.entidadId === nodo.entidadId);
      if (marcador) puntoPorNodoId.set(nodo.id, marcador.punto);
    }

    const conexiones = [];
    let sinResolver = 0;
    for (const conexion of conexionesDiagrama) {
      const puntoOrigen = puntoPorNodoId.get(conexion.nodoOrigenId);
      const puntoDestino = puntoPorNodoId.get(conexion.nodoDestinoId);
      if (puntoOrigen && puntoDestino) {
        conexiones.push({ id: conexion.id, puntoOrigen, puntoDestino });
      } else {
        sinResolver += 1;
      }
    }

    return { conexiones, sinResolver, totalConexiones: conexionesDiagrama.length };
  },
};
