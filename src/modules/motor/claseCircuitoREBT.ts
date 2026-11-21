// src/modules/motor/claseCircuitoREBT.ts
//
// Clasificación "alumbrado" vs "otros usos" de un circuito — la
// necesita REBT (ITC-BT-19 §2.2.2) para decidir su límite de caída de
// tensión; NEC/CIEN no la usan (su límite es un número fijo).
//
// Usuario, 2026-11-21, cita exacta sobre circuitos MIXTOS (alumbrado +
// fuerza en el mismo circuito): el REBT no lo prohíbe, pero a efectos
// de cálculo un circuito con AL MENOS un equipo de iluminación se
// trata como "alumbrado" — el límite MÁS RESTRICTIVO — nunca una
// categoría intermedia. Solo un circuito sin NINGÚN equipo de
// iluminación cae en "otros usos". En vivienda esta distinción no
// cambia nada (3% para los dos casos, ver iec/es.ts) — importa
// específicamente en instalación comercial/industrial.
import type { Equipo } from "./tipos.js";
import type { ClaseCircuitoREBT } from "../normativa/tipos.js";

export function claseCircuitoREBT(equipos: Equipo[]): ClaseCircuitoREBT {
  return equipos.some((e) => e.tipoEquipoNEC === "ILUMINACION_GENERAL") ? "alumbrado" : "otros_usos";
}
