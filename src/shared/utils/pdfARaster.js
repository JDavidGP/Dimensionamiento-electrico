// src/shared/utils/pdfARaster.js
//
// Soporte de PDF para el plano inteligente (Fase 2, 2026-11-20) — ver
// PLANO_INTELIGENTE_DISENO.md §5, tabla de "PDF vectorial": v1 trata
// CUALQUIER PDF como una imagen — renderiza la PÁGINA 1 a un raster
// (vía pdf.js) a una resolución de referencia FIJA, y de ahí en más
// sigue el mismo flujo ya probado de calibración + trazado manual que
// una imagen escaneada. Extraer los paths vectoriales como candidatos
// de pared queda para una ronda aparte (confirmado con el usuario,
// 2026-11-20) — no todo PDF tiene contenido vectorial real (uno
// escaneado-e-incrustado-como-imagen no tiene nada que extraer).
//
// DPI_REFERENCIA es una constante FIJA, no derivada del dispositivo —
// el mismo PDF, en cualquier dispositivo, se rasteriza siempre al
// mismo tamaño en píxeles. Es la misma idea que "espacio imagen es
// fijo, propiedad del archivo" del diseño, aplicada a un PDF: el PDF
// no tiene píxeles propios (usa "puntos", 1/72 de pulgada), así que
// hay que elegir UNA resolución de referencia para convertirlo — y esa
// elección es un número fijo en el código, nunca `window.devicePixelRatio`
// ni nada del dispositivo que lo abre.
//
// Esto NO es un módulo puro (usa `document.createElement("canvas")` y
// pdf.js, que internamente también toca el DOM) — vive en shared/utils
// porque es una utilidad de conversión de formato, no un dominio de la
// app; lo usa el hook (useCircuitos.js) exactamente donde ya vivía la
// carga de imágenes.

const DPI_REFERENCIA = 150;
const PUNTOS_POR_PULGADA_PDF = 72; // unidad nativa de PDF, fija por especificación

/**
 * Renderiza la PRIMERA página de un PDF a un data URL de imagen —
 * misma forma de datos que ya produce la carga de una imagen directa
 * (ver cargarImagenPlano en useCircuitos.js), para no duplicar ningún
 * otro código de calibración/render/persistencia.
 *
 * @param {File} archivo
 * @returns {Promise<{dataUrl:string, anchoPx:number, altoPx:number, paginasTotal:number}>}
 */
export async function renderizarPrimeraPaginaPDF(archivo) {
  // Import dinámico — pdfjs-dist pesa bastante (~1.3MB el worker) y la
  // enorme mayoría de sesiones nunca toca la pestaña Plano con un PDF:
  // cargarlo acá en vez de como import estático arriba hace que Vite lo
  // separe en su propio chunk, descargado SOLO cuando alguien de verdad
  // sube un PDF — nunca en la carga inicial de la app.
  const [pdfjsLib, pdfjsWorkerUrlModulo] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrlModulo.default;

  const bytes = await archivo.arrayBuffer();
  const documento = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pagina = await documento.getPage(1);

  const escala = DPI_REFERENCIA / PUNTOS_POR_PULGADA_PDF;
  const viewport = pagina.getViewport({ scale: escala });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const contexto = canvas.getContext("2d");
  await pagina.render({ canvasContext: contexto, viewport }).promise;

  return {
    dataUrl: canvas.toDataURL("image/png"),
    anchoPx: canvas.width,
    altoPx: canvas.height,
    paginasTotal: documento.numPages,
  };
}

export function esArchivoPDF(archivo) {
  return archivo.type === "application/pdf" || /\.pdf$/i.test(archivo.name || "");
}
