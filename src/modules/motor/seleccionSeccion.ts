// Selección de la sección mínima que cumple AMBAS condiciones:
// ampacidad corregida por temperatura, y caída de tensión bajo el
// límite de la normativa activa. Reusada por calcularCircuito (por
// circuito) y calcularAlimentador (por tramo troncal de tablero) —
// misma regla física, dos usos.
import { resistenciaOhmKm } from "./resistencia.ts";
import { calcularCaidaTension } from "./caidaTension.ts";
import type { Fases } from "./tipos.ts";
import type { Normativa, Material } from "../normativa/tipos.ts";

export interface ParametrosSeleccionSeccion {
  corrienteA: number;
  distanciaM: number;
  cosPhi: number;
  material: Material | string;
  fases: Fases | string;
  temp: number;
  voltajeV: number;
  normativa: Normativa;
}

export interface SeccionSeleccionada {
  seccion: string;
  areaMm2: number;
  r: number;
  x: number;
  caidaPct: number;
  ampacidadCorregida: number;
  fTemp: number;
}

/** null si ninguna sección de la normativa cumple ambas condiciones. */
export function seleccionarSeccion({ corrienteA, distanciaM, cosPhi, material, fases, temp, voltajeV, normativa }: ParametrosSeleccionSeccion): SeccionSeleccionada | null {
  const fTemp = normativa.factorTemperatura(temp);
  const ampacidades = normativa.ampacidad[material as Material];
  const orden = normativa.ordenSecciones[material as Material];

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
