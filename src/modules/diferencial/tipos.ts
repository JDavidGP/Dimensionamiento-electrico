// src/modules/diferencial/tipos.ts
//
// Diferencial (ID, interruptor diferencial) — REBT ITC-BT-25, cita
// exacta: "garantizando un máximo de cinco circuitos por cada
// diferencial". Agrupa hasta 5 circuitos (PIA); cada circuito guarda
// `diferencialId` (FK opcional, mismo patrón que `tableroId` — ver
// modules/tablero/index.ts). El diferencial NO guarda una lista de
// circuitoIds, mismo anti-patrón de doble escritura ya evitado ahí.

export interface Diferencial {
  id: string;
  nombre: string;
  /** Sensibilidad en mA — 30 es lo típico para protección contra contactos directos (el dato que dio pie a esta entidad), pero el campo queda editable por si hace falta otro valor normalizado. */
  sensibilidadMA: number;
  notas: string;
}

export interface DatosDiferencial {
  nombre?: string;
  sensibilidadMA?: number | string;
  notas?: string;
}

export interface ConDiferencialId {
  id: string;
  diferencialId?: string | null;
}
