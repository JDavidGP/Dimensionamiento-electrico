import { RESISTIVIDAD_20C, COEFICIENTE_TEMPERATURA, TEMP_OPERACION_CONDUCTOR_C } from "../../shared/data/materiales.js";
import type { Material } from "../normativa/tipos.ts";

// Resistividad del material corregida a una temperatura dada.
export function resistividadATemperatura(material: Material | string, tempC: number): number {
  const rho20 = RESISTIVIDAD_20C[material as Material];
  const alpha = COEFICIENTE_TEMPERATURA[material as Material];
  return rho20 * (1 + alpha * (tempC - 20));
}

// Resistencia en Ω/km a partir de: material, área transversal (mm²), y
// temperatura de operación del conductor (no la temperatura ambiente).
// R (Ω/km) = ρ (Ω·mm²/m) × 1000 (m/km) / área (mm²)
export function resistenciaOhmKm(material: Material | string, areaMm2: number, tempC: number = TEMP_OPERACION_CONDUCTOR_C): number {
  const rho = resistividadATemperatura(material, tempC);
  return (rho * 1000) / areaMm2;
}
