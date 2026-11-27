// Símbolos del diagrama unifilar — ahora como archivos .svg propios
// (usuario, 2026-11-21: "en formato .SVG"), uno por tipo en
// assets/simbolos-iec/, editables en Inkscape/Illustrator como
// cualquier .svg normal. Antes vivían como marcado inline acá mismo —
// ver el historial de este archivo si hace falta comparar.
//
// Dibujados a mano (ninguno copiado de ningún tercero), tras
// investigar fuentes externas: ninguna cubría el catálogo completo
// con licencia y estilo consistentes (upb-lea/Inkscape_electric_Symbols
// es CC0 pero no cubre instalación eléctrica de edificio; Trpz3/sld es
// MIT pero incompleto y con errores de marcado). Formas GENÉRICAS de
// diagramas unifilares (círculo=medidor/motor, barras de batería,
// bucles de bobina, etc.) — convenciones de uso común en cualquier
// software de esquemas, no arte protegido de nadie. Ninguno es un
// símbolo IEC 60617 oficial reproducido — son equivalentes
// simplificados que SIGUEN la convención general de la norma (ver la
// nota puntual en rele.svg y fusible.svg sobre 2 correcciones
// concretas hechas en esta ronda), consistentes con el resto de la UI.
//
// Cada .svg es un documento válido independiente, viewBox 0 0 32 32,
// con su propio stroke-width ya definido (abre bien en Inkscape tal
// cual) — `stroke="currentColor"` en la raíz para que el color lo
// termine de decidir quien lo use (ver color por categoría en
// DiagramaUnifilar.jsx/PlanoCanvas.jsx). Se cargan con el import
// `?raw` nativo de Vite (sin librería nueva, mismo criterio del resto
// de la app) y se inyectan ya renderizados dentro de un <g> que solo
// se encarga de posición/escala/color — nunca del dibujo en sí.
const archivosSvg = import.meta.glob<string>("../assets/simbolos-iec/*.svg", { query: "?raw", import: "default", eager: true });

const SIMBOLOS: Record<string, string> = {};
for (const ruta in archivosSvg) {
  const tipo = ruta.match(/([^/]+)\.svg$/)![1];
  SIMBOLOS[tipo] = archivosSvg[ruta];
}

// El contenido interno de cada .svg (sin el <svg ...> que lo envuelve)
// se extrae UNA sola vez por tipo con el propio parser del navegador
// — nunca con un regex a mano, que es frágil ante cualquier variación
// de marcado válido (atributos en otro orden, comentarios, etc.).
const cacheContenidoInterno = new Map<string, string>();
function contenidoInterno(tipo: string): string {
  const cacheado = cacheContenidoInterno.get(tipo);
  if (cacheado !== undefined) return cacheado;
  const crudo = SIMBOLOS[tipo];
  const html = crudo ? new DOMParser().parseFromString(crudo, "image/svg+xml").documentElement.innerHTML : "";
  cacheContenidoInterno.set(tipo, html);
  return html;
}

const SIMBOLO_GENERICO_HTML = '<rect x="5" y="5" width="22" height="22" rx="2"/>';

// Grosor de trazo AUTORAL, en unidades del viewBox 32×32 (el mismo
// 1.8 con el que cada .svg se ve bien abierto suelto en Inkscape).
const GROSOR_TRAZO_BASE = 1.8;

/**
 * Símbolo de un componente del diagrama (ahora desde su propio .svg),
 * dentro de un viewBox lógico 32×32. Se extrae solo el contenido
 * INTERNO de cada .svg (ver contenidoInterno arriba), así que el
 * stroke-width declarado en la raíz del archivo (para que se vea bien
 * abierto suelto en Inkscape) no llega al DOM en tiempo de ejecución;
 * los elementos de un símbolo que necesitan otro grosor (ej. las
 * barras largas de banco_baterias.svg, la barra de
 * barra_distribucion.svg) lo declaran ELLOS MISMOS, así que siguen
 * funcionando igual.
 *
 * Bug reportado por el usuario (captura real de su propia instancia,
 * no una foto borrosa — 2026-11-25, "la luminaria sencilla se
 * entiende pero la conmutada no": un marcador de "Tablero eléctrico"/
 * "Caja de empalme" en Plano se veía como un simple punto oscuro
 * sólido, sin ícono visible) — causa raíz: ANTES el `stroke-width` se
 * fijaba en 1.8 SIN COMPENSAR el `scale(size/32)` de este mismo <g>;
 * como el grosor de trazo heredado se pinta en el sistema de
 * coordenadas YA escalado de sus hijos, a un tamaño de marcador chico
 * (14-48px en pantalla, ver tamanoMarcadorPx en PlanoCanvas.jsx) el
 * trazo quedaba en una fracción de píxel — invisible por
 * antialiasing, dejando ver solo el círculo de fondo oscuro detrás.
 * Se compensa de una: el `strokeWidth` que se fija en este <g> es
 * GROSOR_TRAZO_BASE DIVIDIDO por el mismo factor de escala, así que
 * tras aplicar `scale(size/32)` el trazo renderizado SIEMPRE mide
 * GROSOR_TRAZO_BASE en unidades previas al zoom general del plano
 * (mismo criterio que paredes/conductores: sigue escalando con el
 * zoom del lienzo, solo deja de encogerse ADEMÁS por el tamaño propio
 * del ícono).
 */
interface SimboloDiagramaProps {
  tipo: string;
  x?: number;
  y?: number;
  size?: number;
  color?: string;
}

export function SimboloDiagrama({ tipo, x = 0, y = 0, size = 28, color }: SimboloDiagramaProps) {
  const html = SIMBOLOS[tipo] ? contenidoInterno(tipo) : SIMBOLO_GENERICO_HTML;
  const escala = size / 32;
  return (
    <g
      transform={`translate(${x}, ${y}) scale(${escala})`}
      stroke={color}
      strokeWidth={GROSOR_TRAZO_BASE / escala}
      strokeLinecap="round"
      fill="none"
      color={color}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function tieneSimbolo(tipo: string): boolean {
  return Boolean(SIMBOLOS[tipo]);
}
