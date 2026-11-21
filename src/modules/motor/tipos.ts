// src/modules/motor/tipos.ts
//
// Formas mínimas de Circuito/Equipo/Tablero que el motor de cálculo
// necesita LEER — no es (todavía) el modelo canónico completo del
// proyecto (ese vive en hooks/useCircuitos.js, que sigue en JS: los
// componentes/hooks React quedan para una etapa posterior de la
// migración). Cuando se migren, este archivo es el punto natural para
// unificar — por ahora, cualquier objeto con ESTOS campos sirve
// (tipado estructural), de sobra para lo que cada función de motor/
// realmente usa.

import type { Fases, ClaseCircuitoREBT } from "../normativa/tipos.ts";
export type { Fases, ClaseCircuitoREBT };

export interface Equipo {
  nombre: string;
  /** "corriente" = `valor` viene en A (se convierte con el voltaje/fases del circuito); cualquier otro valor = `valor` ya es potencia en W. */
  modoEntrada: "corriente" | "potencia";
  valor: number;
  cosPhi?: number;
  cantidad?: number;
  esCargaContinua?: boolean;
  tipoEquipoNEC?: string;
  corrienteRotorBloqueado?: number | null;
}

export interface Circuito {
  id?: string;
  nombre?: string;
  tipo: "dedicado" | "mixto";
  fases: string;
  material: string;
  voltaje: number;
  distancia: number;
  temp: number;
  factorSimultaneidadManual?: number | null;
}

export interface Tablero {
  longitudAlimentador?: number | string;
  materialAlimentador?: string;
  tensionAlimentacion?: number | string;
}

export interface ImpedanciaFuente {
  r?: number;
  x?: number;
}

export interface DetalleDemandaTipo {
  tipo: string;
  conectadaW: number;
  demandaW: number;
  cantidad: number;
}

/** Resultado de calcularCircuito() cuando sí se pudo dimensionar (seleccionarSeccion encontró un calibre que cumple). */
export interface ResultadoCircuitoOk {
  ok: true;
  id?: string;
  normativa: string;
  nombre?: string;
  tipo: string;
  cantidadEquipos: number;
  potenciaTotal: number;
  cargaConectadaW: number;
  cargaDemandaNormativaW: number;
  cargaEstimadaUsoW: number;
  factorSimultaneidadAplicado: number;
  detalleDemanda: DetalleDemandaTipo[];
  cosPhiEfectivo: number;
  corriente: number;
  corrienteConectada: number;
  corrienteDiseno: number;
  seccion: string;
  unidadSeccion: string;
  areaMm2: number;
  ampacidadCorregida: number;
  caidaPct: number;
  breaker: number | null;
  /** "alumbrado" si tiene algún equipo de iluminación (REBT lo clasifica así incluso mezclado con otros usos), "otros_usos" si ninguno — ver claseCircuitoREBT.ts. NEC/CIEN lo calculan igual pero no lo usan para nada. */
  claseCircuitoREBT: ClaseCircuitoREBT;
  advertencias: string[];
  notaDimensionamiento: string;
}

/** Resultado de calcularCircuito() cuando NO se pudo dimensionar (sin equipos, normativa faltante, o ningún calibre alcanza). */
export interface ResultadoCircuitoError {
  ok: false;
  id?: string;
  nombre?: string;
  normativa?: string;
  tipo?: string;
  cargaConectadaW?: number;
  cargaDemandaNormativaW?: number;
  cargaEstimadaUsoW?: number;
  error: string;
}

export type ResultadoCircuito = ResultadoCircuitoOk | ResultadoCircuitoError;
