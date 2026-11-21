import type { Fases } from "./tipos.ts";

export interface ParametrosCaidaTension {
  corrienteA: number;
  distanciaM: number;
  r: number;
  x: number;
  cosPhi: number;
  voltajeV: number;
  fases: Fases | string;
}

export interface ResultadoCaidaTension {
  deltaV: number;
  porcentaje: number;
}

// Caída de tensión, considerando resistencia (r) y reactancia (x) del
// conductor — fórmula aproximada estándar para cargas con factor de
// potencia distinto de 1 (motores, cargas inductivas).
export function calcularCaidaTension({ corrienteA, distanciaM, r, x, cosPhi, voltajeV, fases }: ParametrosCaidaTension): ResultadoCaidaTension {
  const phi = Math.acos(cosPhi);
  const zEfectivo = (r / 1000) * cosPhi + (x / 1000) * Math.sin(phi);

  const deltaV =
    fases === "tri"
      ? Math.sqrt(3) * distanciaM * corrienteA * zEfectivo
      : 2 * distanciaM * corrienteA * zEfectivo;

  const porcentaje = (deltaV / voltajeV) * 100;

  return { deltaV, porcentaje };
}
