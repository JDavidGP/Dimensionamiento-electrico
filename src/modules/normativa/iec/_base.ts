// src/modules/normativa/iec/_base.ts
//
// Capa BASE internacional de IEC 60364-5-52 — datos y reglas genuinamente
// armonizadas a nivel europeo (ampacidad, secciones, reactancia, factor
// de temperatura). NO se registra directamente ni aparece en el selector:
// le falta la identidad (id/nombre) y la lógica de diversidad de carga,
// que son responsabilidad de cada variante regional (ver iec/es.js).
//
// Cualquier variante nueva (Francia, Alemania...) debe derivar de este
// archivo, nunca duplicar sus tablas.

// Fuente: Tabla C.52.1 bis de la norma UNE-HD 60364-5-52:2014 (adopción
// armonizada europea de IEC 60364-5-52), método de instalación tipo B
// (PVC, 2 conductores activos — monofásico), publicada por Prysmian
// (Libro Blanco de la Instalación). Valores cruzados y confirmados contra
// las cifras de referencia ampliamente citadas en la literatura técnica
// europea (17.5A/24A/32A/41A/57A para 1.5/2.5/4/6/10mm² — coinciden).
import type { Normativa } from "../tipos.ts";

const AMPACIDAD_IEC_MM2: Record<string, Record<string, number>> = {
  cobre: { "1.5": 17.5, "2.5": 24, "4": 32, "6": 41, "10": 57, "16": 77, "25": 100, "35": 119 },
  aluminio: { "2.5": 19, "4": 25, "6": 32, "10": 44, "16": 60 },
};

const ORDEN_MM2_IEC: Record<string, string[]> = {
  cobre: ["1.5", "2.5", "4", "6", "10", "16", "25", "35"],
  aluminio: ["2.5", "4", "6", "10", "16"],
};

const REACTANCIA_IEC: Record<string, number> = {
  "1.5": 0.1, "2.5": 0.09, "4": 0.09, "6": 0.08, "10": 0.08, "16": 0.08, "25": 0.07, "35": 0.07,
};

// Corrección por temperatura ambiente — Tabla B.52.14 de IEC 60364-5-52
// (aislamiento PVC), reescalada porque la tabla de ampacidad de arriba
// está referenciada a 40°C ambiente, no a 30°C:
//   10°C=1.22  15°C=1.17  20°C=1.12  25°C=1.06  30°C=1.00
//   35°C=0.94  40°C=0.87  45°C=0.79  50°C=0.71  55°C=0.61  60°C=0.50
// Se divide cada factor entre el valor a 40°C (0.87) para que el nuevo
// factor valga exactamente 1.0 a 40°C — la condición base de esta tabla.
function factorTemperatura(tempC: number): number {
  const tabla30C: [number, number][] = [
    [10, 1.22], [15, 1.17], [20, 1.12], [25, 1.06], [30, 1.0],
    [35, 0.94], [40, 0.87], [45, 0.79], [50, 0.71], [55, 0.61], [60, 0.5],
  ];
  const FACTOR_A_40C = 0.87; // valor de la tabla original en 40°C, usado para reescalar
  const punto = tabla30C.find(([t]) => tempC <= t) ?? tabla30C[tabla30C.length - 1];
  return punto[1] / FACTOR_A_40C;
}

export const IEC_BASE: Partial<Normativa> = {
  unidadSeccion: "mm²",
  ordenSecciones: ORDEN_MM2_IEC as Normativa["ordenSecciones"],
  areaMm2PorSeccion: null, // la sección YA es el dato (mm²), no hay que convertir
  ampacidad: AMPACIDAD_IEC_MM2 as Normativa["ampacidad"],
  reactanciaOhmKm: REACTANCIA_IEC,
  factorTemperatura,
  notaValidacion:
    "Ampacidad tomada de la norma real (UNE-HD 60364-5-52, método B, PVC 2 conductores), cruzada contra cifras de referencia europeas. Corrección por temperatura propia (referenciada a 40°C, reescalada desde la Tabla B.52.14 de IEC) ya implementada.",
};
