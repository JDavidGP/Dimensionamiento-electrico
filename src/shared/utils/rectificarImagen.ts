// src/shared/utils/rectificarImagen.ts
//
// Aplica una homografía (ver modules/plano/homografia.js) para
// "enderezar" una foto con perspectiva — muestreo inverso: por cada
// píxel del lienzo DESTINO (el rectángulo ideal), se calcula qué
// píxel de la imagen ORIGEN le corresponde (vía la homografía YA
// invertida, destino→origen) y se copia su color. Vecino-más-cercano
// (no bilinear) en esta ronda — más simple y rápido; interpolación
// bilineal para mejor calidad queda como mejora futura, no hace falta
// para que el resultado sea correcto, solo un poco menos suave.
//
// NO es un módulo puro (usa `document.createElement("canvas")`) —
// vive en shared/utils junto a pdfARaster.js, mismo criterio: utilidad
// de conversión de formato de imagen, no un dominio de la app.

function aplicarMatrizPunto(m: number[], x: number, y: number): { x: number; y: number } {
  const w = m[6] * x + m[7] * y + m[8];
  return { x: (m[0] * x + m[1] * y + m[2]) / w, y: (m[3] * x + m[4] * y + m[5]) / w };
}

export interface ImagenRectificada {
  dataUrl: string;
  anchoPx: number;
  altoPx: number;
}

/**
 * @param dataUrlOrigen - la foto tal cual (con perspectiva)
 * @param matrizDestinoAOrigen - homografía YA invertida (destino→origen), ver invertirMatriz3x3
 */
export function rectificarImagen(dataUrlOrigen: string, matrizDestinoAOrigen: number[], anchoDestinoPx: number, altoDestinoPx: number): Promise<ImagenRectificada> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const lienzoOrigen = document.createElement("canvas");
        lienzoOrigen.width = img.naturalWidth;
        lienzoOrigen.height = img.naturalHeight;
        const ctxOrigen = lienzoOrigen.getContext("2d", { willReadFrequently: true });
        if (!ctxOrigen) throw new Error("No se pudo obtener el contexto 2D del lienzo de origen.");
        ctxOrigen.drawImage(img, 0, 0);
        const anchoOrigen = lienzoOrigen.width;
        const altoOrigen = lienzoOrigen.height;
        const pixelesOrigen = ctxOrigen.getImageData(0, 0, anchoOrigen, altoOrigen).data;

        const lienzoDestino = document.createElement("canvas");
        lienzoDestino.width = anchoDestinoPx;
        lienzoDestino.height = altoDestinoPx;
        const ctxDestino = lienzoDestino.getContext("2d");
        if (!ctxDestino) throw new Error("No se pudo obtener el contexto 2D del lienzo de destino.");
        const imagenDestino = ctxDestino.createImageData(anchoDestinoPx, altoDestinoPx);

        for (let y = 0; y < altoDestinoPx; y++) {
          for (let x = 0; x < anchoDestinoPx; x++) {
            const origen = aplicarMatrizPunto(matrizDestinoAOrigen, x, y);
            const sx = Math.round(origen.x);
            const sy = Math.round(origen.y);
            const iDestino = (y * anchoDestinoPx + x) * 4;
            if (sx >= 0 && sx < anchoOrigen && sy >= 0 && sy < altoOrigen) {
              const iOrigen = (sy * anchoOrigen + sx) * 4;
              imagenDestino.data[iDestino] = pixelesOrigen[iOrigen];
              imagenDestino.data[iDestino + 1] = pixelesOrigen[iOrigen + 1];
              imagenDestino.data[iDestino + 2] = pixelesOrigen[iOrigen + 2];
              imagenDestino.data[iDestino + 3] = 255;
            } else {
              imagenDestino.data[iDestino + 3] = 0; // fuera de la foto original: transparente
            }
          }
        }
        ctxDestino.putImageData(imagenDestino, 0, 0);
        resolve({ dataUrl: lienzoDestino.toDataURL("image/png"), anchoPx: anchoDestinoPx, altoPx: altoDestinoPx });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("No se pudo procesar la imagen para corregir la perspectiva."));
    img.src = dataUrlOrigen;
  });
}
