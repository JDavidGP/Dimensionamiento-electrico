// src/modules/tablero/index.js
//
// Módulo Tablero — Fase 3 (dato relacional circuito↔tablero) + Fase 4
// (alimentador: longitud, material, fases, tableroPadreId). CERO
// gráfico. Solo se usa entre sí o a través de TableroMediator.
// No importa UI, motor, documentos ni diagramas.
//
// Diseño de la relación circuito↔tablero: el circuito guarda `tableroId`
// (FK, single source of truth). El tablero NO guarda una lista de
// circuitoIds — evita el mismo anti-patrón de doble escritura que
// ARCHITECTURE.md ya prohíbe para tabla↔diagrama. `circuitosDeTablero()`
// siempre se calcula filtrando, nunca se mantiene una segunda copia.
//
// tableroPadreId ya vive en el modelo (de dónde viene el alimentador),
// pero la lógica de encadenarlo hacia arriba (subpaneles, jerarquía,
// ciclos) es el siguiente paso — no esta sesión.

import { generarId } from "../../shared/utils/id.js";

function normalizar(datos = {}) {
  return {
    nombre: datos.nombre?.trim() || "Tablero sin nombre",
    tensionAlimentacion: Number(datos.tensionAlimentacion) || 0,
    fases: datos.fases || "mono",
    tableroPadreId: datos.tableroPadreId || null,
    longitudAlimentador: Number(datos.longitudAlimentador) || 0,
    materialAlimentador: datos.materialAlimentador?.toLowerCase() || "cobre",
  };
}

export function crearTablero(datos) {
  return { id: generarId(), ...normalizar(datos) };
}

/**
 * Devuelve el tablero con los cambios aplicados — NO muta el original
 * (mismo criterio que asignarCircuitoATablero; la escritura real la
 * aplica la capa de aplicación / hook, ver ARCHITECTURE.md §1.6).
 */
export function editarTablero(tablero, cambios) {
  return { ...tablero, ...normalizar({ ...tablero, ...cambios }) };
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
