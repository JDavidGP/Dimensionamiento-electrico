/// <reference types="vite/client" />

// pdfjs-dist no publica un subpath típico de asset (.svg/.png/...) para
// su worker — Vite sí lo resuelve en runtime (?url devuelve la URL del
// chunk), pero vite/client no declara este módulo porque no es una de
// sus extensiones de asset conocidas. Usado en shared/utils/pdfARaster.ts
// y shared/utils/pdfATexto.ts (import dinámico, mismo patrón en ambos).
declare module "pdfjs-dist/build/pdf.worker.min.mjs?url" {
  const workerUrl: string;
  export default workerUrl;
}
