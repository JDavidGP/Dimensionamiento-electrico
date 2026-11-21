// src/modules/geometria/tipos.ts
//
// Tipos geométricos compartidos — separados de index.ts/vistaZoomPan.ts
// en su propio archivo (en vez de que uno los declare y el otro los
// importe) para que ninguno de los dos dependa del otro: son hermanos,
// no uno hijo del otro.

/** Un punto en CUALQUIER espacio de coordenadas 2D — metros (modelo), píxeles de imagen, o CSS pixels de pantalla, según el contexto de quien lo use. */
export interface Punto {
  x: number;
  y: number;
}
