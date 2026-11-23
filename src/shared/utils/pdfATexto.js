// src/shared/utils/pdfATexto.js
//
// Extrae el texto de TODAS las páginas de un PDF arbitrario (memoria
// técnica, cálculo eléctrico, etc. — no necesariamente generado por
// DEC) — usuario, 2026-11-23: quiere que la app reconozca datos de
// documentos reales de terceros, no solo reabrir sus propios PDFs
// guardados (ver persistencia/pdf.ts para ESE caso, que es distinto:
// ahí se busca un archivo adjunto incrustado, acá se lee el texto
// visible de las páginas).
//
// Mismo patrón de import dinámico que pdfARaster.js (pdfjs-dist pesa
// bastante y la mayoría de sesiones nunca usa esto).

const MAX_PAGINAS = 60; // límite razonable — una memoria técnica real no pasa de esto

export async function extraerTextoPDF(archivo) {
  const [pdfjsLib, pdfjsWorkerUrlModulo] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrlModulo.default;

  const bytes = await archivo.arrayBuffer();
  const documento = await pdfjsLib.getDocument({ data: bytes }).promise;
  const totalPaginas = Math.min(documento.numPages, MAX_PAGINAS);

  const textosPorPagina = [];
  for (let n = 1; n <= totalPaginas; n++) {
    const pagina = await documento.getPage(n);
    const contenido = await pagina.getTextContent();
    const texto = contenido.items.map((item) => item.str).join(" ");
    textosPorPagina.push(texto);
  }

  return {
    texto: textosPorPagina.join("\n\n"),
    paginasLeidas: totalPaginas,
    paginasTotal: documento.numPages,
  };
}
