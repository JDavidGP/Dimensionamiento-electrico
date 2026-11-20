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
import { distancia, areaPoligono, perimetroPoligono } from "../../modules/geometria/index.js";

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

  calcularHomografia,
  aplicarHomografia,
  invertirMatriz3x3,

  generarDXF,
  codificarDXFComoBytes,
};
