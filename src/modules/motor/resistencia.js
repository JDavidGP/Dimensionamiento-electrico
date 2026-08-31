import { RESISTIVIDAD_20C, COEFICIENTE_TEMPERATURA, TEMP_OPERACION_CONDUCTOR_C } from "../../shared/data/materiales.js";

// Resistividad del material corregida a una temperatura dada.
export function resistividadATemperatura(material, tempC) {
  const rho20 = RESISTIVIDAD_20C[material];
  const alpha = COEFICIENTE_TEMPERATURA[material];
  return rho20 * (1 + alpha * (tempC - 20));
}

// Resistencia en Ω/km a partir de: material, área transversal (mm²), y
// temperatura de operación del conductor (no la temperatura ambiente).
// R (Ω/km) = ρ (Ω·mm²/m) × 1000 (m/km) / área (mm²)
export function resistenciaOhmKm(material, areaMm2, tempC = TEMP_OPERACION_CONDUCTOR_C) {
  const rho = resistividadATemperatura(material, tempC);
  return (rho * 1000) / areaMm2;
}
