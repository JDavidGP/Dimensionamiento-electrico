// src/modules/origen/fuentesEnergia.js
//
// Fuente de energía — Batería (banco de baterías) o Generador (ej.
// diesel) — como origen alternativo de un tablero, además de otro
// tablero o la acometida. Pedido explícito del usuario: que quede
// "registrado dentro de la memoria del proyecto" con su rol (PRINCIPAL/
// SECUNDARIA/AUXILIAR — ej. un generador diesel auxiliar ante fallas
// de red). Ver la nota larga sobre "fuentes de energía" en
// modules/origen/index.js para el contexto completo de esta decisión.
//
// Acometida NO es una entidad acá — sigue siendo la condición "sin
// padre" (TIPOS_ORIGEN.ACOMETIDA en index.js). Transformador tampoco
// está incluido todavía — esa es una decisión de planificación aparte
// (se integra con el sistema de media tensión más adelante), ver
// modules/motor/transformador.js.
//
// CERO cálculo todavía: esto es puramente registro/documentación (qué
// fuente alimenta qué tablero, con qué rol) — no hay lógica de
// conmutación paralelo/turnos ni de capacidad (eso sigue pendiente,
// ver la nota correspondiente en modules/origen/index.js).
//
// Módulo puro — se usa a través de OrigenMediator, igual criterio que
// modules/tablero/index.js con TableroMediator.

import { generarId } from "../../shared/utils/id.js";

export const TIPOS_FUENTE_ENERGIA = {
  BATERIA: "bateria",
  GENERADOR: "generador",
};

export const ROLES_FUENTE_ENERGIA = {
  PRINCIPAL: "principal",
  SECUNDARIA: "secundaria",
  AUXILIAR: "auxiliar",
};

export const FUENTE_ENERGIA_VACIA = {
  nombre: "",
  tipo: TIPOS_FUENTE_ENERGIA.BATERIA,
  rol: ROLES_FUENTE_ENERGIA.AUXILIAR,
  capacidadKW: "",
  notas: "",
};

function normalizar(datos = {}) {
  return {
    nombre: datos.nombre?.trim() || "Fuente sin nombre",
    tipo: Object.values(TIPOS_FUENTE_ENERGIA).includes(datos.tipo) ? datos.tipo : TIPOS_FUENTE_ENERGIA.BATERIA,
    rol: Object.values(ROLES_FUENTE_ENERGIA).includes(datos.rol) ? datos.rol : ROLES_FUENTE_ENERGIA.AUXILIAR,
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
