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
      metodo: "dos_puntos",
      puntoA: puntoImagenA,
      puntoB: puntoImagenB,
      distanciaRealM,
      escalaMetrosPorPixel: distanciaRealM / distanciaPixeles,
    },
  };
}

/**
 * Calibración ALTERNATIVA (usuario, 2026-11-20): en vez de 2 puntos +
 * una distancia conocida entre ellos, el instalador traza el contorno
 * exterior completo (como ya hace con una pared) y declara el
 * PERÍMETRO REAL total de ese contorno — útil cuando conoce la
 * medida total del edificio/ambiente pero no una distancia puntual
 * entre 2 esquinas específicas. La escala sale de dividir el
 * perímetro real por el perímetro del mismo contorno medido en
 * píxeles de imagen (cierra el último punto con el primero, igual
 * criterio que perimetroPoligono en modules/geometria/).
 *
 * @param {{x:number,y:number}[]} puntosImagen - contorno trazado, en orden (no hace falta repetir el primero al final)
 * @param {number} perimetroRealM
 * @returns {{ok:true, calibracion:object} | {ok:false, motivo:string}}
 */
export function calcularEscalaPorPerimetro(puntosImagen, perimetroRealM) {
  if (!Array.isArray(puntosImagen) || puntosImagen.length < 3) {
    return { ok: false, motivo: "Hacen falta al menos 3 puntos para trazar un contorno cerrado." };
  }
  if (!(perimetroRealM > 0)) {
    return { ok: false, motivo: "El perímetro real debe ser mayor a 0." };
  }

  let perimetroPixeles = 0;
  for (let i = 0; i < puntosImagen.length; i++) {
    const a = puntosImagen[i];
    const b = puntosImagen[(i + 1) % puntosImagen.length];
    perimetroPixeles += Math.hypot(b.x - a.x, b.y - a.y);
  }
  if (perimetroPixeles === 0) {
    return { ok: false, motivo: "El contorno trazado no tiene longitud (los puntos coinciden)." };
  }

  return {
    ok: true,
    calibracion: {
      metodo: "perimetro",
      puntosContorno: puntosImagen,
      perimetroRealM,
      escalaMetrosPorPixel: perimetroRealM / perimetroPixeles,
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
