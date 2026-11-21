// src/modules/persistencia/pdf.ts
//
// Dominio: empaquetar/desempaquetar el proyecto como UN SOLO archivo
// .pdf, en vez de .json — pedido explícito del usuario (2026-11-22),
// con la opción que recomendé y que eligió: el PDF se ve e imprime
// como una ficha legible del proyecto, pero lleva ADENTRO (adjunto,
// invisible al leerlo) una copia EXACTA de los mismos datos que antes
// viajaban en el .json — nunca se intenta "leer los números impresos"
// para reconstruir el proyecto (eso sería mucho más frágil: cualquier
// PDF reimpreso/editado podría perder precisión). ProyectoSerializado
// (tipos.ts) no cambia en nada — este módulo solo decide en qué
// CONTENEDOR viaja.
//
// `pdf-lib` soporta escribir adjuntos (`PDFDocument.attach`) con una
// API de alto nivel, pero NO ofrece una forma de alto nivel de leerlos
// de vuelta — hay que recorrer a mano el árbol /Names/EmbeddedFiles
// del documento (ver extraerBytesAdjunto). Validado con un adjunto
// real de ~4MB (simulando una imagen de plano en base64): escritura y
// lectura toman decenas de milisegundos, sin pérdida de datos
// (ver tests/test_persistencia_pdf.mjs).
//
// `import("pdf-lib")` DINÁMICO a propósito (no estático): es una
// librería pesada (~400KB) que solo hace falta al guardar/abrir un
// proyecto, nunca en la carga inicial — importante para el empaquetado
// como PWA (usuario, 2026-11-22), donde el tamaño del bundle inicial
// afecta directamente cuánto tarda en abrir en un celular. Vite la
// separa en su propio chunk, cargado on-demand. El `import type` de
// abajo es solo para que TypeScript tipe el código — se borra del todo
// al compilar, no mete pdf-lib en el bundle.
import type { PDFDocument as PDFDocumentType } from "pdf-lib";

async function cargarPdfLib() {
  return import("pdf-lib");
}

export const NOMBRE_ARCHIVO_ADJUNTO = "proyecto.json";

/** Arma el PDF: una ficha legible de 1 página + los datos completos adjuntos. */
export async function generarPdfProyecto(datos: unknown, opciones: { tituloFicha?: string; lineasFicha?: string[] } = {}): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts } = await cargarPdfLib();
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 en puntos
  const fuenteNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fuenteNegrita = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 780;
  page.drawText(opciones.tituloFicha || "Proyecto DEC", { x: 50, y, size: 20, font: fuenteNegrita });
  y -= 30;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1 });
  y -= 25;

  for (const linea of opciones.lineasFicha ?? []) {
    page.drawText(linea, { x: 50, y, size: 11, font: fuenteNormal });
    y -= 18;
  }

  y -= 15;
  page.drawText("Este archivo lleva los datos completos del proyecto incrustados.", { x: 50, y, size: 10, font: fuenteNormal });
  y -= 14;
  page.drawText('Abrilo directamente en DEC ("Abrir") para seguir trabajando donde quedó.', { x: 50, y, size: 10, font: fuenteNormal });

  const jsonBytes = new TextEncoder().encode(JSON.stringify(datos));
  await pdfDoc.attach(jsonBytes, NOMBRE_ARCHIVO_ADJUNTO, {
    mimeType: "application/json",
    description: "Datos completos del proyecto (DEC)",
    creationDate: new Date(),
    modificationDate: new Date(),
  });

  return pdfDoc.save();
}

/** Busca el adjunto por nombre en el árbol /Names/EmbeddedFiles y devuelve sus bytes DECODIFICADOS (sin el filtro FlateDecode). */
function extraerBytesAdjunto(lib: typeof import("pdf-lib"), pdfDoc: PDFDocumentType, nombreBuscado: string): Uint8Array | null {
  const { PDFName, PDFDict, PDFArray, PDFHexString, PDFString, decodePDFRawStream } = lib;
  const namesDict = pdfDoc.catalog.lookupMaybe(PDFName.of("Names"), PDFDict);
  const embeddedFilesDict = namesDict?.lookupMaybe(PDFName.of("EmbeddedFiles"), PDFDict);
  const namesArray = embeddedFilesDict?.lookupMaybe(PDFName.of("Names"), PDFArray);
  if (!namesArray) return null;

  for (let i = 0; i < namesArray.size(); i += 2) {
    const nombreRaw = namesArray.lookup(i);
    const nombre = nombreRaw instanceof PDFHexString || nombreRaw instanceof PDFString ? nombreRaw.decodeText() : null;
    if (nombre !== nombreBuscado) continue;
    const specDict = namesArray.lookupMaybe(i + 1, PDFDict);
    const efDict = specDict?.lookupMaybe(PDFName.of("EF"), PDFDict);
    const stream = efDict?.lookup(PDFName.of("F"));
    if (!stream) return null;
    return decodePDFRawStream(stream as Parameters<typeof decodePDFRawStream>[0]).decode();
  }
  return null;
}

/** Desempaqueta: lee el adjunto y devuelve los datos (sin validar su forma — eso lo sigue haciendo deserializarProyecto, igual que con el .json de siempre). */
export async function extraerDatosDePdf(pdfBytes: Uint8Array | ArrayBuffer): Promise<unknown> {
  const lib = await cargarPdfLib();
  const bytes = pdfBytes instanceof ArrayBuffer ? new Uint8Array(pdfBytes) : pdfBytes;
  let pdfDoc: PDFDocumentType;
  try {
    pdfDoc = await lib.PDFDocument.load(bytes);
  } catch {
    throw new Error("El archivo no es un PDF válido.");
  }

  const adjunto = extraerBytesAdjunto(lib, pdfDoc, NOMBRE_ARCHIVO_ADJUNTO);
  if (!adjunto) {
    throw new Error("Este PDF no tiene datos de proyecto DEC incrustados (¿es un PDF de otro origen, o el informe técnico impreso en vez del archivo guardado?).");
  }

  try {
    return JSON.parse(new TextDecoder().decode(adjunto));
  } catch {
    throw new Error("Los datos incrustados en este PDF están corruptos o no se pudieron leer.");
  }
}
