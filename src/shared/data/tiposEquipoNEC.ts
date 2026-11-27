// Tipos de equipo según NEC Art. 220 / 422 / 430 / 440.
// Cada tipo activa su propia regla de demanda; no se usa un % genérico.

export interface TipoEquipoNEC {
  id: string;
  label: string;
  articulo: string;
  descripcion: string;
}

export const TIPOS_EQUIPO_NEC: Record<string, TipoEquipoNEC> = {
  ILUMINACION_GENERAL: {
    id: "ILUMINACION_GENERAL",
    label: "Iluminación general",
    articulo: "Art. 220.42",
    descripcion: "Carga de alumbrado general — demanda escalonada por VA total.",
  },
  PEQUENO_ELECTRODOMESTICO: {
    id: "PEQUENO_ELECTRODOMESTICO",
    label: "Pequeño electrodoméstico",
    articulo: "Art. 220.53",
    descripcion: "4 o más equipos fijos: 75 % de la carga nominal. Menos de 4: 100 %.",
  },
  COCINA_ELECTRICA: {
    id: "COCINA_ELECTRICA",
    label: "Cocina eléctrica",
    articulo: "Art. 220.55",
    descripcion: "Tabla de demanda según cantidad y kW nominal (no lineal).",
  },
  SECADORA_ROPA: {
    id: "SECADORA_ROPA",
    label: "Secadora de ropa",
    articulo: "Art. 220.54",
    descripcion: "Demanda por cantidad de secadoras (mín. 5 kW o nombreplate).",
  },
  MOTOR: {
    id: "MOTOR",
    label: "Motor",
    articulo: "Art. 430.24",
    descripcion: "Motor mayor al 125 % + resto al 100 %. Opcional: corriente de rotor bloqueado.",
  },
  CALEFACCION_AGUA: {
    id: "CALEFACCION_AGUA",
    label: "Calefacción / agua",
    articulo: "Art. 422",
    descripcion: "Carga al 100 % (+ continuidad si aplica). Sin tabla de diversidad propia.",
  },
  AIRE_ACONDICIONADO: {
    id: "AIRE_ACONDICIONADO",
    label: "Aire acondicionado",
    articulo: "Art. 440",
    descripcion: "Carga al 100 % (+ continuidad si aplica). Circuitos dedicados típicos.",
  },
  CARGA_GENERAL: {
    id: "CARGA_GENERAL",
    label: "Carga general",
    articulo: "Art. 220.14",
    descripcion: "Sin demanda especial — 100 % de la carga conectada (+ continuidad).",
  },
};

export const LISTA_TIPOS_EQUIPO_NEC: TipoEquipoNEC[] = Object.values(TIPOS_EQUIPO_NEC);

/** Tabla 220.55 Columna A — demanda (kW) para cocinas ≤ 12 kW por unidad. */
export const TABLA_220_55_COL_A: Record<number, number> = {
  1: 8,
  2: 11,
  3: 14,
  4: 17,
  5: 20,
  6: 21,
  7: 22,
  8: 23,
  9: 24,
  10: 25,
  11: 26,
  12: 27,
  13: 28,
  14: 29,
  15: 30,
  16: 31,
  17: 32,
  18: 33,
  19: 34,
  20: 35,
  21: 36,
  22: 37,
  23: 38,
  24: 39,
  25: 40,
};

/** Nota 1 Col. A: por cada kW (o fracción) que exceda 12 kW, sumar 5 % a la demanda de tabla. */
export const NOTA1_220_55_UMBRAL_KW: number = 12;
export const NOTA1_220_55_PCT_POR_KW: number = 0.05;
