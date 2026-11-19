// src/modules/origen/fuentesEnergia.js
//
// Fuente de energía — Batería (banco de baterías) o Generador (ej.
// diesel) — como origen alternativo de un tablero, además de otro
// tablero o la acometida. Ver la nota larga sobre "fuentes de energía"
// en modules/origen/index.js para el contexto completo de esta
// decisión.
//
// Acometida NO es una entidad acá — sigue siendo la condición "sin
// padre" (TIPOS_ORIGEN.ACOMETIDA en index.js). Transformador tampoco
// está incluido todavía — esa es una decisión de planificación aparte
// (se integra con el sistema de media tensión más adelante), ver
// modules/motor/transformador.js.
//
// Esta entidad YA NO tiene su propio campo `rol` (principal/secundaria/
// auxiliar) — lo tuvo al principio, pero el usuario detectó el
// problema real: una misma fuente física (ej. "Banco solar") puede ser
// PRINCIPAL para un tablero y AUXILIAR para otro, así que un rol fijo
// acá "entraba en conflicto" con el rol que se elige por tablero (ver
// PanelTableros.jsx: tableroPadreId = principal, fuenteSecundariaId,
// fuenteAuxiliarId). El rol es contextual a CADA tablero, nunca una
// propiedad inherente de la fuente — una sola fuente de verdad, acá
// solo se describe QUÉ ES la fuente (nombre/tipo/capacidad/notas).
//
// CERO cálculo todavía: esto es puramente registro/documentación — no
// hay lógica de conmutación paralelo/turnos ni de capacidad real (eso
// sigue pendiente, ver la nota correspondiente en modules/origen/index.js).
//
// Módulo puro — se usa a través de OrigenMediator, igual criterio que
// modules/tablero/index.js con TableroMediator.

import { generarId } from "../../shared/utils/id.js";

export const TIPOS_FUENTE_ENERGIA = {
  BATERIA: "bateria",
  GENERADOR: "generador",
};

export const FUENTE_ENERGIA_VACIA = {
  nombre: "",
  tipo: TIPOS_FUENTE_ENERGIA.BATERIA,
  capacidadKW: "",
  notas: "",
};

function normalizar(datos = {}) {
  return {
    nombre: datos.nombre?.trim() || "Fuente sin nombre",
    tipo: Object.values(TIPOS_FUENTE_ENERGIA).includes(datos.tipo) ? datos.tipo : TIPOS_FUENTE_ENERGIA.BATERIA,
    capacidadKW: datos.capacidadKW === "" || datos.capacidadKW == null ? "" : Number(datos.capacidadKW) || 0,
    notas: datos.notas || "",
  };
}

export function crearFuenteEnergia(datos) {
  return { id: generarId(), ...normalizar(datos) };
}

/** Devuelve la fuente con los cambios aplicados — no muta la original
 * (mismo criterio que editarTablero). */
export function editarFuenteEnergia(fuente, cambios) {
  return { ...fuente, ...normalizar({ ...fuente, ...cambios }) };
}

/**
 * Al eliminar una fuente de energía, los tableros que la tenían como
 * `tableroPadreId` quedan sin padre (null = acometida), no apuntando a
 * un ID muerto — mismo criterio que liberarCircuitosDeTablero en
 * modules/tablero/index.js.
 */
export function liberarTablerosDeFuente(fuenteId, tableros = []) {
  return tableros.map((t) => (t.tableroPadreId === fuenteId ? { ...t, tableroPadreId: null } : t));
}
