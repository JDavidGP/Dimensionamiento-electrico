// src/modules/validacion/tipos.ts
//
// Formas mínimas que este módulo necesita LEER/CONSTRUIR — no es
// (todavía) el modelo canónico completo del proyecto, que sigue en
// hooks/useCircuitos.js (en JS hasta la etapa de componentes/hooks).
// Circuito/Equipo extienden las formas mínimas ya definidas en
// modules/motor/tipos.ts (mismos campos que el motor necesita calcular)
// y agregan lo propio de este módulo (id, etiqueta/función, tableroId,
// representación, etc.) — evita redefinir desde cero lo que ya se
// definió para el motor.

import type { Circuito as CircuitoMotor, Equipo as EquipoMotor } from "../motor/tipos.ts";

export interface Equipo extends EquipoMotor {
  id: string;
  circuitoId?: string | null;
  etiqueta?: string;
  funcion?: string;
  /** Altura real de instalación de la caja (tomacorriente, interruptor...), en metros — opcional, puramente física. null/undefined = no cargada, no se suma ningún extra de altura al trazar su conductor en el Plano (ver modules/plano/alturaInstalacion.ts). */
  alturaInstalacionM?: number | string | null;
  /** Desde dónde se mide esa altura: "techo" (default, el conductor baja desde el cielo/losa) o "piso" (sube desde el piso) — ver modules/plano/alturaInstalacion.ts para el porqué del default. */
  referenciaAltura?: "techo" | "piso" | null;
}

export interface Circuito extends CircuitoMotor {
  id: string;
  etiqueta?: string;
  funcion?: string;
  representacion?: string;
  tableroId?: string | null;
  /** REBT ITC-BT-25 — diferencial (ID) que agrupa este circuito, opcional. */
  diferencialId?: string | null;
  lineas?: unknown[];
  voltajeManual?: boolean;
  /** No se persiste en el modelo real (se calcula) — algunos llamadores igual lo pasan de largo como dato ya resuelto. */
  breaker?: number | string | null;
  /** Igual que breaker: no persistido, pero aceptado como fallback si algún llamador ya lo trae resuelto. */
  calibre?: string | null;
}

export interface EntidadConId {
  id: string;
  nombre?: string;
}

export interface Tablero extends EntidadConId {
  tableroPadreId?: string | null;
  conmutacion?: Conmutacion | null;
}

export interface Conmutacion {
  activa?: boolean;
  fuentePrincipalId?: string | null;
  fuenteSecundariaId?: string | null;
  fuenteAuxiliarId?: string | null;
}

export interface FuenteEnergia extends EntidadConId {
  tipo?: string;
}

export interface Transformador extends EntidadConId {
  fases?: string;
  tensionPrimariaV?: number | string;
  tensionSecundariaV?: number | string;
}

export interface Diferencial extends EntidadConId {
  sensibilidadMA?: number | string;
}

export interface NodoDiagrama {
  entidadId?: string | null;
}

export interface MarcadorEquipoPlano {
  entidadId?: string | null;
}

export interface Proyecto {
  id?: string;
  nombre?: string;
  tableros?: Tablero[];
}

/**
 * Resultado de calcularCircuito() tal como lo consume este módulo —
 * deliberadamente más LAXO que ResultadoCircuito (modules/motor/tipos.ts):
 * incluye un par de campos de fallback (`breakerSeleccionado`, `calibre`)
 * que ya no produce el motor actual pero que este validador sigue
 * aceptando por compatibilidad hacia atrás (ver validarCircuitoElectrico).
 */
export interface ResultadoCalculoLaxo {
  ok?: boolean;
  cargaDemandaNormativaW?: number;
  potenciaTotal?: number;
  corrienteDiseno?: number;
  corriente?: number;
  breaker?: number | null;
  breakerSeleccionado?: number | null;
  seccion?: string;
  calibre?: string | null;
  advertencias?: string[];
  error?: string;
}

export interface ResultadoVerificacionNormativa {
  ok: boolean;
  mensajes?: string[];
}

export interface NormativaEngine {
  verificarCircuito?: (
    circuito: Circuito,
    args: { corriente: number; breaker: number | string | null; calibre: string | null; equipos: Equipo[] }
  ) => ResultadoVerificacionNormativa | null | undefined;
}

export type Estado = "ok" | "advertencia" | "error";
