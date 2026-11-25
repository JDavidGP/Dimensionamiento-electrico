// src/modules/motor/profundidadEnterradoNEC.ts
//
// Profundidad mínima de enterrado — NEC 300.5, Tabla 300.5. Geométrico/
// normativo puro: no calcula ampacidad ni corriente, solo valida una
// profundidad real contra el mínimo exigido según el tipo de conducto y
// dónde pasa la zanja. Las 3 categorías de conducto son las columnas
// reales de la Tabla 300.5 (no hay una columna por cada tipo de
// conducto — EMT desde NEC 2023, RTRC y HDPE comparten la columna "pvc"
// porque exigen la misma profundidad de 18in que PVC Sch.40/80).
export type CategoriaConductoEnterradoNEC = "pvc" | "rmc_imc" | "cable_directo";
export type UbicacionEnterradoNEC = "general" | "bajo_concreto_2in" | "bajo_edificacion" | "calzada_estacionamiento" | "driveway_residencial";

export const CATEGORIAS_CONDUCTO_ENTERRADO_NEC: { valor: CategoriaConductoEnterradoNEC; label: string }[] = [
  { valor: "pvc", label: "PVC Sch. 40/80, RTRC, HDPE, EMT (2023+ con fittings de enterrado)" },
  { valor: "rmc_imc", label: "RMC / IMC (metálico rígido)" },
  { valor: "cable_directo", label: "Cable directamente enterrado, sin conducto" },
];

export const UBICACIONES_ENTERRADO_NEC: { valor: UbicacionEnterradoNEC; label: string }[] = [
  { valor: "general", label: "General (tierra/jardín)" },
  { valor: "bajo_concreto_2in", label: 'Bajo 2" de concreto' },
  { valor: "bajo_edificacion", label: "Bajo una edificación" },
  { valor: "calzada_estacionamiento", label: "Bajo calzada o estacionamiento" },
  { valor: "driveway_residencial", label: "Bajo driveway residencial" },
];

const TABLA_PROFUNDIDAD_MINIMA_NEC_IN: Record<UbicacionEnterradoNEC, Record<CategoriaConductoEnterradoNEC, number>> = {
  general: { pvc: 18, rmc_imc: 6, cable_directo: 24 },
  bajo_concreto_2in: { pvc: 12, rmc_imc: 6, cable_directo: 18 },
  bajo_edificacion: { pvc: 0, rmc_imc: 0, cable_directo: 0 },
  calzada_estacionamiento: { pvc: 24, rmc_imc: 24, cable_directo: 24 },
  driveway_residencial: { pvc: 18, rmc_imc: 18, cable_directo: 18 },
};

export function profundidadMinimaEnterradoNEC(categoria: CategoriaConductoEnterradoNEC, ubicacion: UbicacionEnterradoNEC): number | null {
  return TABLA_PROFUNDIDAD_MINIMA_NEC_IN[ubicacion]?.[categoria] ?? null;
}
