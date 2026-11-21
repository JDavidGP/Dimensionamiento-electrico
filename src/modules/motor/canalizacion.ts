// src/modules/motor/canalizacion.ts
//
// Llenado de conducto: geométrico puro, NO depende de topología/Tablero
// (a diferencia del factor de agrupamiento, que sí — ver checklist).
// Recibe la normativa activa y usa su tabla `canalizaciones` — si la
// normativa no tiene esa tabla todavía (ej. IEC_ES), lo indica
// explícitamente en vez de fallar en silencio.
import type { Normativa } from "../normativa/tipos.ts";

export interface ConductorCanalizacion {
  awg: number | string;
  cantidad: number;
}

export type ResultadoLlenadoConducto =
  | {
      disponible: true;
      areaTotalConductoresIn2: number;
      cantidadTotalConductores: number;
      porcentajeMaximo: number;
      tamanoMinimo: string;
      areaInternaIn2: number;
      porcentajeLlenadoReal: number;
    }
  | {
      disponible: false;
      motivo: string;
      areaTotalConductoresIn2?: number;
      cantidadTotalConductores?: number;
      porcentajeMaximo?: number;
    };

export function calcularLlenadoConducto(conductores: ConductorCanalizacion[], tipoConducto: string, normativa: Normativa): ResultadoLlenadoConducto {
  const tabla = normativa.canalizaciones;
  if (!tabla) {
    return { disponible: false, motivo: `La normativa ${normativa.id} todavía no tiene tabla de canalizaciones cargada.` };
  }
  if (!tabla.areaConductorAisladoIn2 || !tabla.areaInternaConductoIn2[tipoConducto]) {
    return { disponible: false, motivo: `Tipo de conducto "${tipoConducto}" no está en la tabla de ${normativa.id}.` };
  }

  const cantidadTotalConductores = conductores.reduce((s, c) => s + c.cantidad, 0);

  let areaTotalConductoresIn2 = 0;
  for (const c of conductores) {
    const areaUnitaria = tabla.areaConductorAisladoIn2[c.awg];
    if (areaUnitaria == null) {
      return { disponible: false, motivo: `Calibre ${c.awg} AWG no está en la tabla de conductor aislado de ${normativa.id}.` };
    }
    areaTotalConductoresIn2 += areaUnitaria * c.cantidad;
  }

  const porcentajeMaximo = tabla.porcentajeLlenadoMaximo(cantidadTotalConductores);
  const tamanosDisponibles = tabla.areaInternaConductoIn2[tipoConducto];

  // Buscar el tamaño comercial más chico cuya área disponible (área interna × % máximo) alcance
  for (const tamano of tabla.ordenTamanos) {
    const areaInternaIn2 = tamanosDisponibles[tamano];
    if (areaInternaIn2 == null) continue; // ese tamaño no existe para este tipo de conducto
    const areaDisponibleIn2 = areaInternaIn2 * porcentajeMaximo;
    if (areaTotalConductoresIn2 <= areaDisponibleIn2) {
      return {
        disponible: true,
        areaTotalConductoresIn2,
        cantidadTotalConductores,
        porcentajeMaximo,
        tamanoMinimo: tamano,
        areaInternaIn2,
        porcentajeLlenadoReal: areaTotalConductoresIn2 / areaInternaIn2,
      };
    }
  }

  return {
    disponible: false,
    motivo: `Ningún tamaño de ${tipoConducto} disponible en la tabla de ${normativa.id} alcanza para estos conductores — se necesita un tamaño mayor al listado.`,
    areaTotalConductoresIn2,
    cantidadTotalConductores,
    porcentajeMaximo,
  };
}
