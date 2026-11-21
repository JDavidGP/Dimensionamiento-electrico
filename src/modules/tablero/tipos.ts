// src/modules/tablero/tipos.ts
//
// Forma de Tablero que ESTE módulo normaliza/crea — el modelo canónico
// completo del proyecto sigue viviendo en hooks/useCircuitos.js (en JS
// hasta la etapa de componentes/hooks de la migración). Las funciones
// que solo LEEN/PASAN campos de Circuito (no los normalizan) usan
// genéricos en vez de una interfaz Circuito completa — preservan
// cualquier campo extra del objeto real sin tener que conocerlo acá
// (ver asignarCircuitoATablero/asignarLineasACircuito más abajo).

export interface Tablero {
  id?: string;
  nombre: string;
  etiqueta: string;
  funcion: string;
  tensionAlimentacion: number;
  fases: string;
  capacidadKW: number | "";
  tableroPadreId: string | null;
  longitudAlimentador: number;
  materialAlimentador: string;
  lineasAlimentador: string[];
  conmutacion: Record<string, unknown> | null;
  simultaneidadREBT: Record<string, unknown> | null;
  gradoElectrificacion: "basica" | "elevada" | null;
  notas: string;
}

export interface DatosTablero extends Partial<Omit<Tablero, "id">> {}

export interface ConTableroId {
  tableroId?: string | null;
}
