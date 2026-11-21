// src/modules/origen/tipos.ts
//
// Formas mínimas que este módulo necesita — el modelo canónico
// completo del proyecto sigue en hooks/useCircuitos.js (plain JS,
// todavía no migrado). Tablero/Transformador se reusan de sus módulos
// ya migrados en vez de redefinirlos acá.

import type { Tablero } from "../tablero/tipos.ts";
import type { Transformador } from "../motor/transformador.ts";

export type { Tablero, Transformador };

export const TIPOS_FUENTE_ENERGIA = {
  RED_LOCAL: "red_local",
  BATERIA: "bateria",
  GENERADOR: "generador",
} as const;

export type TipoFuenteEnergia = (typeof TIPOS_FUENTE_ENERGIA)[keyof typeof TIPOS_FUENTE_ENERGIA];

export const ROLES_FUENTE = {
  PRINCIPAL: "principal",
  SECUNDARIA: "secundaria",
  AUXILIAR: "auxiliar",
} as const;

export type RolFuente = (typeof ROLES_FUENTE)[keyof typeof ROLES_FUENTE] | "";

export interface FuenteEnergia {
  id?: string;
  nombre: string;
  tipo: TipoFuenteEnergia;
  rol: RolFuente;
  capacidadKW: number | "";
  distanciaM: number | "";
  materialConductor: "cobre" | "aluminio";
  horarioInicio: string;
  horarioFin: string;
  notas: string;
}

export interface DatosFuenteEnergia extends Partial<Omit<FuenteEnergia, "id">> {}

export const MODOS_CONMUTACION = {
  FALLA_AUTOMATICA: "falla_automatica",
  HORARIO: "horario",
  MANUAL: "manual",
} as const;

export type ModoConmutacion = (typeof MODOS_CONMUTACION)[keyof typeof MODOS_CONMUTACION];

export interface Conmutacion {
  activa: boolean;
  modo: ModoConmutacion;
  fuentePrincipalId: string;
  fuenteSecundariaId: string;
  fuenteAuxiliarId: string;
  horarioPrincipalInicio: string;
  horarioPrincipalFin: string;
  notas: string;
}

export interface DatosConmutacion extends Partial<Conmutacion> {}

export interface TableroConPadre {
  tableroPadreId?: string | null;
}
