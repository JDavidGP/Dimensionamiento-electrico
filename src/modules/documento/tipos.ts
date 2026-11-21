// src/modules/documento/tipos.ts
//
// Formas mínimas que este módulo necesita LEER/CONSTRUIR — no es
// (todavía) el modelo canónico completo del proyecto, que sigue en
// hooks/useCircuitos.js (en JS hasta la etapa de componentes/hooks).
// Circuito/Equipo/Tablero/resultado de circuito se reusan de los
// módulos ya migrados (validacion/, tablero/, motor/) en vez de
// redefinirlos — este archivo solo agrega lo propio del informe:
// la forma de un alimentador YA AGREGADO (con simultaneidadREBT),
// que es un resultado EXTENDIDO que arma TableroMediator (todavía en
// JS) a partir del de motor/calcularAlimentador, no el mismo tipo.

import type { Circuito, Equipo } from "../validacion/tipos.ts";
import type { Tablero } from "../tablero/tipos.ts";
import type { ResultadoCircuito } from "../motor/tipos.ts";

export type { Circuito, Equipo, Tablero, ResultadoCircuito };

/**
 * Resultado de alimentador YA AGREGADO por tablero (TableroMediator.
 * calcularAlimentadorAgregado) — más amplio que ResultadoAlimentador
 * de motor/calcularAlimentador.ts: agrega simultaneidadREBT cuando
 * aplica, y sus variantes "no ok" pueden traer `motivo` o `error`.
 */
export interface AlimentadorResultado {
  ok: boolean;
  potenciaTotalW?: number;
  corrienteDiseno?: number;
  seccion?: string;
  unidadSeccion?: string;
  breaker?: number | null;
  caidaPct?: number;
  simultaneidadREBT?: unknown;
  motivo?: string;
  error?: string;
}

export interface EntradaIntegridad {
  estado: string;
  problemas?: string[];
  [clave: string]: unknown;
}

export interface NormativaResuelta {
  id: string;
  nombre: string;
}

export interface TipoInstalacionResuelto {
  id: string;
  label: string;
}

export interface DatosMemoriaTecnica {
  proyecto?: { nombre?: string; [clave: string]: unknown } | null;
  normativa: NormativaResuelta;
  tipoInstalacion?: TipoInstalacionResuelto | null;
  circuitos?: Circuito[];
  equipos?: Equipo[];
  resultados?: ResultadoCircuito[];
  tableros?: Tablero[];
  alimentadores?: Record<string, AlimentadorResultado>;
  origenPorTablero?: Record<string, string>;
  fuentesEnergia?: unknown[];
  transformadores?: unknown[];
  listaIntegridad?: EntradaIntegridad[];
}

export interface FilaCircuito {
  id?: string;
  nombre: string;
  tipo: string;
  fases: string;
  voltaje: number;
  material: string;
  cantidadEquipos: number;
  ok: boolean;
  potenciaW: number | null;
  corrienteA: number | null;
  seccion: string | null;
  unidadSeccion: string | null;
  breaker: number | null;
  caidaPct: number | null;
  advertencias: string[];
  error: string | null;
}

export interface FilaTablero {
  id?: string;
  nombre: string;
  tensionAlimentacion: number;
  fases: string;
  origen: string;
  ok: boolean;
  potenciaW: number | null;
  corrienteA: number | null;
  seccion: string | null;
  unidadSeccion: string | null;
  breaker: number | null;
  caidaPct: number | null;
  simultaneidadREBT: unknown;
  motivo: string | null;
}

export interface Totales {
  potenciaTotalW: number;
  corrienteTotalA: number;
  circuitosOk: number;
  circuitosTotal: number;
}

export interface MemoriaTecnica {
  proyecto: { nombre?: string; [clave: string]: unknown };
  fechaGeneracion: string;
  normativa: NormativaResuelta | { id: string; nombre: string };
  tipoInstalacion: TipoInstalacionResuelto | null;
  circuitos: FilaCircuito[];
  totales: Totales;
  tableros: FilaTablero[];
  fuentesEnergia: unknown[];
  transformadores: unknown[];
  integridad: {
    resumen: Record<string, number>;
    entradas: EntradaIntegridad[];
  };
}
