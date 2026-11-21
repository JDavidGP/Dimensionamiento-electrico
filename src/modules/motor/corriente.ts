import type { Fases } from "./tipos.ts";

// Cálculo de corriente por Ley de Ohm/Potencia.
// fases: "mono" | "bi" | "tri"
// "bi" (bifásico, típico 240V con dos líneas vivas) usa la misma fórmula
// que "mono" — la diferencia entre mono y bifásico está en el voltaje
// (ya viene dado por separado), no en la fórmula de corriente. Solo el
// trifásico usa el factor √3.
export function calcularCorriente(potenciaW: number, voltajeV: number, fases: Fases | string, cosPhi = 1.0): number {
  if (fases === "tri") {
    return potenciaW / (Math.sqrt(3) * voltajeV * cosPhi);
  }
  return potenciaW / (voltajeV * cosPhi);
}

// Calcula la potencia (W) a partir de corriente — útil cuando la ficha
// técnica de un equipo da Voltaje + Amperios en vez de Watts.
export function potenciaDesdeCorriente(corrienteA: number, voltajeV: number, fases: Fases | string, cosPhi = 1.0): number {
  if (fases === "tri") {
    return Math.sqrt(3) * voltajeV * corrienteA * cosPhi;
  }
  return voltajeV * corrienteA * cosPhi;
}
