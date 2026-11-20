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
// Esta entidad tuvo un campo `rol` (principal/secundaria/auxiliar) al
// principio, se quitó, y VOLVIÓ — pero con un significado distinto.
// La primera vez era un rol fijo POR FUENTE que entraba en conflicto
// con el rol que se elegía por tablero (una misma fuente física podía
// ser principal para un tablero y auxiliar para otro). Lo que el
// usuario pidió ahora (2026-11-20) es otra cosa: un rol GLOBAL de la
// instalación completa — "esta es la fuente principal de la casa,
// esta la secundaria, esta la auxiliar" — declarado UNA vez acá, no
// por cada tablero. Para instalación residencial básica esto
// reemplaza a la selección de fuenteSecundariaId/fuenteAuxiliarId que
// vive en PanelTableros.jsx (gateada a avanzada/industrial, donde sí
// puede hacer falta variar la combinación por tablero). Al ser un rol
// de instalación, no de tablero, no vuelve a aparecer el conflicto que
// motivó sacarlo la primera vez.
//
// Para que no haya dos fuentes con el mismo rol a la vez (ver
// limpiarRolDuplicado más abajo, usado desde el hook): asignarle un
// rol a una fuente se lo quita a cualquier otra que lo tuviera — un
// solo lugar de verdad por rol, igual criterio que "una sola fuente de
// verdad" que ya regía antes de este cambio.
//
// "Red local" (red eléctrica pública/acometida) pasa a ser un tipo de
// fuente más, creable/editable igual que batería y generador — pedido
// explícito del usuario para que la instalación pueda declarar
// "mi principal es la red local" con sus propios datos (distancia,
// material, entrada prevista), en vez de ser solo una condición
// implícita sin registro (tableroPadreId null). Esto es ADITIVO: ese
// `null` (sin fuente explícita) sigue significando "acometida
// genérica, sin detalle" — ningún proyecto viejo necesita migrarse,
// la fuente "Red local" es algo que el instalador crea cuando quiere
// el detalle completo.
//
// distanciaM/materialConductor: la distancia (m) y el material del
// conductor desde ESTA fuente hasta el punto de conexión — mismo
// catálogo de materiales que ya usa el alimentador de un tablero
// (PanelTableros.jsx, materialAlimentador: cobre/aluminio). Cuando un
// tablero cuelga directo de esta fuente y no declaró su propia
// distancia/material, TableroMediator.calcularAlimentadorAgregado usa
// estos como respaldo (ver ese archivo) — evita pedir el mismo dato
// dos veces en el caso común (un tablero por fuente). Si distintos
// tableros cuelgan de la misma fuente con tramos reales distintos
// (calibres distintos), cada tablero puede seguir declarando los
// suyos propios en su formulario (avanzada/industrial) y esos
// pisan este respaldo.
//
// horarioInicio/horarioFin: franja horaria en la que se espera usar
// esta fuente (ej. "red de día, batería de noche") — puramente
// registro/documental por ahora, igual criterio que
// modules/origen/conmutacion.js: no hay todavía un motor que recalcule
// contra una fuente distinta según la hora.
//
// capacidadKW sigue siendo la "entrada de energía prevista" de la
// fuente (mismo campo, nombre sin cambios para no romper nada que ya
// lo use).
//
// Módulo puro — se usa a través de OrigenMediator, igual criterio que
// modules/tablero/index.js con TableroMediator.

import { generarId } from "../../shared/utils/id.js";

export const TIPOS_FUENTE_ENERGIA = {
  RED_LOCAL: "red_local",
  BATERIA: "bateria",
  GENERADOR: "generador",
};

export const ROLES_FUENTE = {
  PRINCIPAL: "principal",
  SECUNDARIA: "secundaria",
  AUXILIAR: "auxiliar",
};

export const FUENTE_ENERGIA_VACIA = {
  nombre: "",
  tipo: TIPOS_FUENTE_ENERGIA.RED_LOCAL,
  rol: "",
  capacidadKW: "",
  distanciaM: "",
  materialConductor: "cobre",
  horarioInicio: "",
  horarioFin: "",
  notas: "",
};

function normalizar(datos = {}) {
  return {
    nombre: datos.nombre?.trim() || "Fuente sin nombre",
    tipo: Object.values(TIPOS_FUENTE_ENERGIA).includes(datos.tipo) ? datos.tipo : TIPOS_FUENTE_ENERGIA.BATERIA,
    rol: Object.values(ROLES_FUENTE).includes(datos.rol) ? datos.rol : "",
    capacidadKW: datos.capacidadKW === "" || datos.capacidadKW == null ? "" : Number(datos.capacidadKW) || 0,
    distanciaM: datos.distanciaM === "" || datos.distanciaM == null ? "" : Number(datos.distanciaM) || 0,
    materialConductor: datos.materialConductor === "aluminio" ? "aluminio" : "cobre",
    horarioInicio: datos.horarioInicio || "",
    horarioFin: datos.horarioFin || "",
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

/**
 * Garantiza que, de TODAS las fuentes, a lo sumo una tenga cada rol —
 * si `fuenteId` acaba de tomar `rol`, se lo quita a cualquier OTRA
 * fuente que ya lo tuviera (nunca quedan dos "principal" a la vez).
 * `rol` vacío no hace nada (no tiene sentido "liberar" un no-rol).
 */
export function limpiarRolDuplicado(fuentes = [], fuenteId, rol) {
  if (!rol) return fuentes;
  return fuentes.map((f) => (f.id !== fuenteId && f.rol === rol ? { ...f, rol: "" } : f));
}
