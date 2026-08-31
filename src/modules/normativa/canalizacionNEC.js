// src/data/normativas/canalizacionNEC.js
//
// Datos físicos de llenado de conducto (NEC Capítulo 9). Se usa desde
// nec.js y se hereda por CIEN igual que el resto de las tablas — NO es
// un dato de marca comercial, lo fija la norma UL 83 sobre espesor de
// aislamiento, independiente del fabricante.
//
// ALCANCE ACTUAL: THHN/THWN (el aislamiento estándar para cableado fijo
// en Centroamérica) en calibres 14-2 AWG, y conductos EMT/PVC Sch. 40 en
// tamaños comerciales 1/2" a 1-1/4" — el rango típico de instalación
// residencial/comercial pequeña en Nicaragua. Ampliar la tabla (más
// calibres, IMC, RMC, tubería flexible) es agregar filas, no tocar la
// lógica de cálculo.
//
// Fuente: NEC Capítulo 9, Tabla 5 (área de conductor aislado THHN) y
// Tabla 4 (área interna de conducto EMT/PVC Sch. 40), valores cruzados
// contra múltiples referencias técnicas independientes (calculadoras de
// llenado de conducto de uso profesional, guías de examen de electricista).

/** Área del conductor THHN/THWN AISLADO, en in² — NEC Cap. 9 Tabla 5. */
export const AREA_THHN_IN2 = {
  14: 0.0097,
  12: 0.0133,
  10: 0.0211,
  8: 0.0366,
  6: 0.0507,
  4: 0.0824,
  3: 0.0973,
  2: 0.1158,
};

/** Área interna del conducto, en in² — NEC Cap. 9 Tabla 4 (100% del área, sin aplicar aún el % de llenado). */
export const AREA_INTERNA_CONDUCTO_IN2 = {
  EMT: {
    '1/2': 0.304,
    '3/4': 0.533,
    '1': 0.864,
    '1-1/4': 1.496,
  },
  PVC_SCH40: {
    '1/2': 0.285,
    '3/4': 0.508,
    '1': 0.832,
    '1-1/4': 1.453,
  },
};

/** Orden de tamaños comerciales, de menor a mayor, para buscar el mínimo que alcance. */
export const ORDEN_TAMANOS_CONDUCTO = ['1/2', '3/4', '1', '1-1/4'];

/**
 * % de llenado máximo permitido — NEC Cap. 9 Tabla 1.
 * 1 conductor: 53% | 2 conductores: 31% | 3+ conductores: 40%
 */
export function porcentajeLlenadoMaximo(cantidadConductores) {
  if (cantidadConductores <= 1) return 0.53;
  if (cantidadConductores === 2) return 0.31;
  return 0.4;
}

export const CANALIZACION_NEC = {
  tiposDisponibles: ['EMT', 'PVC_SCH40'],
  areaConductorAisladoIn2: AREA_THHN_IN2,
  areaInternaConductoIn2: AREA_INTERNA_CONDUCTO_IN2,
  ordenTamanos: ORDEN_TAMANOS_CONDUCTO,
  porcentajeLlenadoMaximo,
  notaValidacion:
    'THHN/THWN (Tabla 5) y EMT/PVC Sch.40 (Tabla 4) del NEC Cap. 9, calibres 14-2 AWG y tamaños 1/2\"-1-1/4\". Rango ampliable agregando filas, sin tocar la lógica.',
};
