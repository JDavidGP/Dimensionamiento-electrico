// src/modules/diferencial/index.ts
//
// Módulo Diferencial — dato relacional puro (mismo nivel que
// modules/tablero/index.ts), REBT ITC-BT-25. CERO gráfico. Solo se usa
// entre sí o a través de DiferencialMediator.
//
// Usuario, 2026-11-25 ("El diferencial se supone que agrupa x cantidad
// de PIA según normativa... así que supongo que si debería tener su
// propio marcador en el plano"): confirmó la entidad + su marcador
// propio en el Plano (ver "diferencial" en bibliotecaComponentes.js,
// mismo patrón que "circuito"). El límite de circuitos por diferencial
// lo confirmó FIJO (sin variar por tipo de instalación): "usa el 5
// fijo por ahora, es lo que está anotado en la normativa diferencial
// de 30 miliamperios por cada 5 PIA" — cita exacta en ITC-BT-25:
// "garantizando un máximo de cinco circuitos por cada diferencial".
// REBT únicamente (ver DiferencialMediator): NEC/CIEN no tienen este
// concepto de agrupación (GFCI/AFCI van por circuito, no por bloque de
// 5), así que la UI que crea diferenciales queda gateada a IEC_ES —
// este módulo en sí no conoce normativas, solo datos relacionales.

import { generarId } from "../../shared/utils/id.js";
import type { Diferencial, DatosDiferencial, ConDiferencialId } from "./tipos.ts";

/** ITC-BT-25, cita exacta: "garantizando un máximo de cinco circuitos por cada diferencial". Confirmado FIJO por el usuario, no varía por tipo de instalación. */
export const MAX_CIRCUITOS_POR_DIFERENCIAL = 5;

function normalizar(datos: DatosDiferencial = {}): Omit<Diferencial, "id"> {
  return {
    nombre: datos.nombre?.trim() || "Diferencial sin nombre",
    // 30mA = protección contra contactos directos (el valor que dio
    // pie a esta entidad) — default razonable, pero editable: existen
    // diferenciales de otra sensibilidad (ej. 300mA, selectivos) que
    // este campo no restringe a propósito, documental como notas.
    sensibilidadMA: Number(datos.sensibilidadMA) || 30,
    notas: datos.notas || "",
  };
}

export function crearDiferencial(datos: DatosDiferencial): Diferencial {
  return { id: generarId(), ...normalizar(datos) };
}

/** Devuelve el diferencial editado; el hook decide cómo guardarlo (no muta el original). */
export function editarDiferencial(diferencial: Diferencial, cambios: DatosDiferencial): Diferencial {
  return { ...diferencial, ...normalizar({ ...diferencial, ...cambios }) };
}

/** Circuitos que pertenecen a un diferencial (lectura calculada, no una segunda copia). */
export function circuitosDeDiferencial<C extends ConDiferencialId>(diferencialId: string, circuitos: C[] = []): C[] {
  return circuitos.filter((c) => c.diferencialId === diferencialId);
}

/**
 * Devuelve el circuito con diferencialId actualizado — NO muta el
 * original (misma convención que asignarCircuitoATablero). Pasar
 * `null` desasigna.
 */
export function asignarCircuitoADiferencial<C extends ConDiferencialId>(circuito: C, diferencialId: string | null): C {
  return { ...circuito, diferencialId: diferencialId ?? null };
}

/** Al eliminar un diferencial, los circuitos que le pertenecían quedan sin asignar (no se borran, no quedan apuntando a un ID muerto). */
export function liberarCircuitosDeDiferencial<C extends ConDiferencialId>(diferencialId: string, circuitos: C[] = []): C[] {
  return circuitos.map((c) => (c.diferencialId === diferencialId ? { ...c, diferencialId: null } : c));
}

// Usuario, 2026-11-26, "citar normativas para las distancias de
// instalación" — al investigar el equivalente REBT de GFCI/AFCI (que
// hasta esta ronda no tenían ninguna cita propia bajo IEC_ES), el
// texto consolidado oficial (BOE-A-2002-18099-consolidado.pdf) da la
// respuesta real: REBT NO distingue por tipo de ambiente como NEC
// 210.8 (GFCI) — exige diferencial ≤30mA para TODOS los circuitos, sin
// excepción, desde ITC-BT-25 §2.1. Cita LITERAL: "Uno o varios
// interruptores diferenciales que garanticen la protección contra
// contactos indirectos de todos los circuitos, con una intensidad
// diferencial-residual máxima de 30 mA". No existe un equivalente de
// AFCI (protección por detección de arco) para circuitos ramales
// residenciales en el texto consolidado — la única mención de
// detección de arco en todo el reglamento es para corriente continua
// de sistemas fotovoltaicos (ITC-BT-40), un contexto distinto; esto no
// es una laguna de esta app, es que REBT de verdad no lo exige.
export const SENSIBILIDAD_MAXIMA_DIFERENCIAL_GENERAL_MA = 30;

export interface RequerimientoDiferencialREBT {
  requiere: boolean;
  /** Cita de sección — null si ya tiene un diferencial asignado. */
  motivo: string | null;
}

/**
 * ¿Este circuito (bajo REBT) le falta un diferencial que lo proteja?
 * A diferencia de GFCI/AFCI (NEC, por tipo de ambiente), ITC-BT-25
 * exige diferencial en TODOS los circuitos sin excepción — por eso no
 * toma ningún tipo de ambiente. No conoce normativas: el llamador
 * gatea esto a IEC_ES (mismo criterio que proteccionGFCI.ts/
 * proteccionAFCI.ts/volumenesBano.ts).
 */
export function requiereDiferencialREBT<C extends ConDiferencialId>(circuito: C): RequerimientoDiferencialREBT {
  if (circuito.diferencialId) return { requiere: false, motivo: null };
  return {
    requiere: true,
    motivo: `ITC-BT-25 §2.1 — todo circuito debe quedar protegido por un diferencial ≤${SENSIBILIDAD_MAXIMA_DIFERENCIAL_GENERAL_MA}mA`,
  };
}
