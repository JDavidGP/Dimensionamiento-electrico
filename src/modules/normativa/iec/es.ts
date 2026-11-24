// src/modules/normativa/iec/es.ts
//
// Variante regional: España — deriva de iec/_base.js y aporta lo que la
// capa internacional no cubre: identidad, breakers comerciales locales,
// límite de caída de tensión y (a futuro) diversidad de carga vía
// REBT/ITC-BT-10.
//
// ⚠ Diversidad IEC pendiente A NIVEL DE CIRCUITO: la propia IEC
// 60364-5-52 NO define factores de diversidad por circuito — esa lógica
// vive en anexos nacionales (en España, REBT ITC-BT-10), y factorDiversidad
// queda null a propósito acá (reglasDemanda vacío, todo cae en
// demandaPorDefecto) porque ITC-BT-10 no opera a ese nivel.
//
// CONECTADO (usuario, 2026-11-19) a nivel TABLERO, que es donde
// ITC-BT-10 realmente calcula simultaneidad (acometida compartida por
// varias viviendas) — ver modules/motor/simultaneidadREBT.js (Tabla 1,
// verificada contra el texto oficial) y
// TableroMediator.calcularAlimentadorAgregado (tablero.simultaneidadREBT).
// No vive acá porque un circuito individual no tiene "número de
// viviendas" que simultanear — ese dato es de la relación padre↔hijos
// entre tableros, no de la normativa de un circuito suelto.

import { IEC_BASE } from "./_base.ts";
import type { Normativa, ReglaDemanda, ContextoCaidaTensionREBT } from "../tipos.ts";
import { TIPOS_INSTALACION } from "../../../shared/constants/constantes.js";

// Breakers estándar IEC 60898 (tamaños típicos disponibles comercialmente)
const BREAKERS_IEC_ES = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];

/** Sin diversidad implementada todavía: 100% de la suma. */
const demanda100: ReglaDemanda = (potenciasW) => {
  return potenciasW.reduce((s, p) => s + p, 0);
};

// Caída de tensión REBT — ITC-BT-19 §2.2.2 (RD 842/2002), cita exacta
// confirmada por el usuario (2026-11-21), texto literal:
//   "...menor del 3% de la tensión nominal para cualquier circuito
//   interior de viviendas, y para otras instalaciones interiores o
//   receptoras, del 3% para alumbrado y del 5% para los demás usos."
//   "Para instalaciones industriales que se alimenten directamente en
//   alta tensión mediante un transformador de distribución propio, se
//   considerará que la instalación interior de baja tensión tiene su
//   origen en la salida del transformador. En este caso las caídas de
//   tensión máximas admisibles serán del 4,5% para alumbrado y del
//   6,5% para los demás usos."
//
// Tabla completa (vivienda / otras instalaciones / transformador
// propio), confirmada por el usuario:
//   Viviendas                              → 3% alumbrado, 3% otros usos
//   Otras instalaciones (sin transformador) → 3% alumbrado, 5% otros usos
//   Industrial con transformador propio AT/BT → 4,5% alumbrado, 6,5% otros usos
//
// Clasificación de un circuito MIXTO (alumbrado + fuerza): confirmada
// por el usuario con una segunda cita — REBT no prohíbe mezclar, pero
// a efectos de cálculo un circuito con AL MENOS un equipo de
// iluminación se trata como "alumbrado" (el límite más restrictivo),
// nunca una categoría intermedia — ver claseCircuitoREBT en
// modules/motor/claseCircuitoREBT.ts.
//
// NOTA DE ALCANCE: el texto de ITC-BT-19 §2.2.2 describe la caída
// ORIGEN→PUNTO DE UTILIZACIÓN (lo que esta app llama "acumulada" —
// ver evaluarCaidaAcumulada). No hay, en las citas confirmadas, un
// número DISTINTO para "la caída de este tramo en particular" — por
// eso acá se usa la MISMA tabla para limiteCaidaTensionTramoPct y
// limiteCaidaTensionAcumuladaPct: en una cadena de un solo tablero son
// literalmente el mismo número (el tramo ES toda la instalación); en
// una cadena más larga, el chequeo por tramo queda como una
// verificación extra conservadora (cada segmento individual tampoco
// puede exceder el total permitido), mientras el chequeo acumulado
// sigue siendo el que de verdad hace valer el límite real de la norma.
function limiteCaidaTensionREBT({ tipoInstalacion, claseCircuito, tieneTransformadorPropio }: ContextoCaidaTensionREBT): number {
  if (tipoInstalacion !== TIPOS_INSTALACION.COMERCIAL_INDUSTRIAL) {
    return 3.0; // viviendas (residencial básico/avanzado): 3% para cualquier circuito, sin distinción
  }
  if (tieneTransformadorPropio) {
    return claseCircuito === "alumbrado" ? 4.5 : 6.5;
  }
  return claseCircuito === "alumbrado" ? 3.0 : 5.0;
}

export const IEC_ES: Normativa = {
  ...(IEC_BASE as Normativa),
  id: "IEC_ES",
  nombre: "IEC 60364-5-52 (España — REBT)",
  familia: "IEC",
  region: "España (REBT ITC-BT-10)",
  breakersComerciales: BREAKERS_IEC_ES,
  limiteCaidaTensionPct: 3.0,
  voltajesPorFase: { mono: [230], bi: [230], tri: [400] },
  // No se ofrece "Bi" en la UI para una instalación NUEVA bajo REBT —
  // confirmado por el usuario (electricista, 2026-11-24): España no
  // tiene hoy una red bifásica de distribución estándar; lo que a
  // veces se llama así es o un vestigio de redes antiguas 127/220V en
  // desuso, o un "monofásico compuesto" (2 fases+neutro de una
  // acometida trifásica) que es funcionalmente monofásico de 230V
  // para el equipo — ninguno es una categoría nueva a dimensionar. Se
  // deja voltajesPorFase.bi arriba sin tocar (no se borra el dato) por
  // si algún día hace falta representar uno de esos casos existentes.
  fasesDisponibles: ["mono", "tri"],
  reglasDemanda: {}, // sin reglas propias todavía — todo cae en demandaPorDefecto
  demandaPorDefecto: demanda100,
  factorDiversidad: null, // placeholder — pendiente de nivel Tablero (REBT ITC-BT-10)
  limiteCaidaTensionTramoPct: limiteCaidaTensionREBT,
  limiteCaidaTensionAcumuladaPct: limiteCaidaTensionREBT,
  validado: true, // la ampacidad heredada de IEC_BASE ya está validada
  // notaValidacion desactualizada hasta 2026-11-24: decía "pendiente de
  // implementar" sobre la simultaneidad REBT (ITC-BT-10), pero eso se
  // conectó el 2026-11-19 a nivel Tablero (ver comentario arriba,
  // TableroMediator.calcularAlimentadorAgregado + PanelTableros.jsx,
  // "Edificio de viviendas") — texto corregido para que no contradiga
  // lo que el programa ya hace.
  notaValidacion: IEC_BASE.notaValidacion as string,
};
