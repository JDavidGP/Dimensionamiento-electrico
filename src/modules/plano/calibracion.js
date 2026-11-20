// src/modules/plano/calibracion.js
//
// Escala del proyecto — ver PLANO_INTELIGENTE_DISENO.md §4. El usuario
// marca 2 puntos sobre la imagen (YA convertidos a espacio imagen, en
// píxeles — nunca en píxeles de pantalla, ver coordenadas.js) cuya
// distancia real conoce; acá se calcula el escalar metros-por-píxel
// UNA sola vez. De ahí en más, cada punto trazado se convierte a
// metros con `imagenAModelo` y el motor geométrico/eléctrico ya no
// vuelve a tocar la imagen ni la calibración.
//
// Módulo puro — se usa a través de PlanoMediator.

/**
 * @param {{x:number,y:number}} puntoImagenA
 * @param {{x:number,y:number}} puntoImagenB
 * @param {number} distanciaRealM
 * @returns {{ok:true, calibracion:object} | {ok:false, motivo:string}}
 */
export function calcularEscala(puntoImagenA, puntoImagenB, distanciaRealM) {
  const dx = puntoImagenB.x - puntoImagenA.x;
  const dy = puntoImagenB.y - puntoImagenA.y;
  const distanciaPixeles = Math.hypot(dx, dy);

  if (distanciaPixeles === 0) {
    return { ok: false, motivo: "Los dos puntos de calibración no pueden ser el mismo punto." };
  }
  if (!(distanciaRealM > 0)) {
    return { ok: false, motivo: "La distancia real debe ser mayor a 0." };
  }

  return {
    ok: true,
    calibracion: {
      puntoA: puntoImagenA,
      puntoB: puntoImagenB,
      distanciaRealM,
      escalaMetrosPorPixel: distanciaRealM / distanciaPixeles,
    },
  };
}

/** Punto en espacio IMAGEN (píxeles) → punto en espacio MODELO (metros reales). */
export function imagenAModelo(puntoImagen, escalaMetrosPorPixel) {
  return { x: puntoImagen.x * escalaMetrosPorPixel, y: puntoImagen.y * escalaMetrosPorPixel };
}

/** Inversa — para dibujar (el fondo es una imagen en píxeles, los trazos se guardan en metros). */
export function modeloAImagen(puntoModelo, escalaMetrosPorPixel) {
  return { x: puntoModelo.x / escalaMetrosPorPixel, y: puntoModelo.y / escalaMetrosPorPixel };
}
