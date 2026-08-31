// src/modules/tablero/index.js
//
// Módulo Tablero — Fase 3 (dato relacional puro, CERO gráfico).
// Solo se usa entre sí o a través de TableroMediator.
// No importa UI, motor, documentos ni diagramas.
//
// Diseño de la relación: el circuito guarda `tableroId` (FK, single
// source of truth). El tablero NO guarda una lista de circuitoIds —
// evita el mismo anti-patrón de doble escritura que ARCHITECTURE.md
// ya prohíbe para tabla↔diagrama. `circuitosDe()` siempre se calcula
// filtrando, nunca se mantiene una segunda copia.

import { generarId } from "../../shared/utils/id.js";

export function crearTablero({ nombre, tensionAlimentacion, fases, tableroPadreId, longitudAlimentador, materialAlimentador }) {
  return {
    id: generarId(),
    nombre: nombre?.trim() || "Tablero sin nombre",
    tensionAlimentacion: Number(tensionAlimentacion) || 0,
    fases: fases || "mono",
    tableroPadreId: tableroPadreId ?? null,
    longitudAlimentador: Number(longitudAlimentador) || 0,
    materialAlimentador: materialAlimentador?.toLowerCase() || "cobre",
  };
}

/** Circuitos que pertenecen a un tablero (lectura, calculada). */
export function circuitosDeTablero(tableroId, circuitos = []) {
  return circuitos.filter((c) => c.tableroId === tableroId);
}

/** Circuitos sin ningún tablero asignado todavía. */
export function circuitosSinTablero(circuitos = []) {
  return circuitos.filter((c) => !c.tableroId);
}

/**
 * Devuelve el circuito con tableroId actualizado — NO muta el original
 * (mutaciones reales las aplica la capa de aplicación / hook, ver
 * ARCHITECTURE.md §1.6). Pasar `null` desasigna.
 */
export function asignarCircuitoATablero(circuito, tableroId) {
  return { ...circuito, tableroId: tableroId ?? null };
}

/**
 * Al eliminar un tablero, los circuitos que le pertenecían quedan sin
 * asignar (no se borran, no quedan huérfanos apuntando a un ID muerto).
 */
export function liberarCircuitosDeTablero(tableroId, circuitos = []) {
  return circuitos.map((c) =>
    c.tableroId === tableroId ? { ...c, tableroId: null } : c
  );
}
