// Selección de la sección mínima que cumple AMBAS condiciones:
// ampacidad corregida por temperatura, y caída de tensión bajo el
// límite de la normativa activa. Reusada por calcularCircuito (por
// circuito) y calcularAlimentador (por tramo troncal de tablero) —
// misma regla física, dos usos.
import { resistenciaOhmKm } from "./resistencia.js";
import { calcularCaidaTension } from "./caidaTension.js";

/**
 * @returns {{seccion, areaMm2, r, x, caidaPct, ampacidadCorregida} | null}
 *   null si ninguna sección de la normativa cumple ambas condiciones.
 */
export function seleccionarSeccion({ corrienteA, distanciaM, cosPhi, material, fases, temp, voltajeV, normativa }) {
  const fTemp = normativa.factorTemperatura(temp);
  const ampacidades = normativa.ampacidad[material];
  const orden = normativa.ordenSecciones[material];

  for (const seccion of orden) {
    const ampacidadCorregida = ampacidades[seccion] * fTemp;
    if (ampacidadCorregida < corrienteA) continue;

    const areaMm2 = normativa.areaMm2PorSeccion ? normativa.areaMm2PorSeccion[seccion] : parseFloat(seccion);
    const r = resistenciaOhmKm(material, areaMm2);
    const x = normativa.reactanciaOhmKm[seccion];

    const { porcentaje: caidaPct } = calcularCaidaTension({
      corrienteA,
      distanciaM,
      r,
      x,
      cosPhi,
      voltajeV,
      fases,
    });

    if (caidaPct > normativa.limiteCaidaTensionPct) continue;

    return { seccion, areaMm2, r, x, caidaPct, ampacidadCorregida, fTemp };
  }
  return null;
}
