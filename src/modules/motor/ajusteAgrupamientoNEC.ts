// src/modules/motor/ajusteAgrupamientoNEC.ts
//
// Factor de ajuste por agrupamiento de conductores portadores de
// corriente (CCC) en un mismo conducto — NEC 310.15(B)(2)(a). Geométrico
// puro, igual criterio que canalizacion.ts: no sabe de Tablero/topología,
// solo recibe la cantidad de CCC ya contada por quien llama (ver
// conductoresPortadoresCorriente abajo, y BloqueLlenadoConducto en
// PanelTableros.jsx, que es quien suma los CCC de los circuitos
// elegidos). Distinto del llenado físico (Cap. 9 Tabla 1): ESTE factor
// reduce la AMPACIDAD del conductor, no el tamaño de tubo necesario.
export interface RangoFactorAjusteCCC {
  maxConductores: number;
  factor: number;
}

/** NEC 310.15(B)(2)(a). ≤3 CCC: la regla no aplica (factor 1, sin reducción). */
export const TABLA_FACTOR_AJUSTE_CCC_NEC: RangoFactorAjusteCCC[] = [
  { maxConductores: 3, factor: 1 },
  { maxConductores: 6, factor: 0.8 },
  { maxConductores: 9, factor: 0.7 },
  { maxConductores: 20, factor: 0.5 },
  { maxConductores: 40, factor: 0.4 },
  { maxConductores: Infinity, factor: 0.25 },
];

export function factorAjusteConductoresPortadoresNEC(cantidadCCC: number): number {
  for (const rango of TABLA_FACTOR_AJUSTE_CCC_NEC) {
    if (cantidadCCC <= rango.maxConductores) return rango.factor;
  }
  return 0.25;
}

/**
 * Conductores portadores de corriente (CCC) de UN circuito, según sus
 * fases — NEC 310.15(E) y nota al pie de la Tabla 310.15(B)(2)(a).
 * Simplificación deliberada (no modela cada excepción de la norma):
 * el neutro de un circuito monofásico/bifásico SIEMPRE cuenta (puede
 * llevar tanta corriente como cualquier fase); el de un circuito
 * trifásico de 4 hilos NO cuenta, asumiendo carga balanceada (la
 * excepción más común en instalaciones residenciales/comerciales
 * típicas) — un trifásico con carga no-lineal severamente desbalanceada
 * SÍ debería contar el neutro, pero eso requiere un dato que hoy el
 * circuito no declara. La tierra (EGC) nunca cuenta, en ningún caso.
 */
export function conductoresPortadoresCorriente(fases: string): number {
  return fases === "tri" ? 3 : 2;
}
