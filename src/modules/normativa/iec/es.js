// src/data/normativas/iec/es.js
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

import { IEC_BASE } from "./_base.js";

// Breakers estándar IEC 60898 (tamaños típicos disponibles comercialmente)
const BREAKERS_IEC_ES = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];

/** Sin diversidad implementada todavía: 100% de la suma. */
function demanda100(potenciasW) {
  return potenciasW.reduce((s, p) => s + p, 0);
}

export const IEC_ES = {
  ...IEC_BASE,
  id: "IEC_ES",
  nombre: "IEC 60364-5-52 (España — REBT)",
  familia: "IEC",
  region: "España (REBT ITC-BT-10)",
  breakersComerciales: BREAKERS_IEC_ES,
  limiteCaidaTensionPct: 3.0,
  voltajesPorFase: { mono: [230], bi: [230], tri: [400] },
  reglasDemanda: {}, // sin reglas propias todavía — todo cae en demandaPorDefecto
  demandaPorDefecto: demanda100,
  factorDiversidad: null, // placeholder — pendiente de nivel Tablero (REBT ITC-BT-10)
  validado: true, // la ampacidad heredada de IEC_BASE ya está validada
  notaValidacion:
    IEC_BASE.notaValidacion +
    " Diversidad/simultaneidad REBT (ITC-BT-10) pendiente de implementar: es un cálculo de alimentador compartido entre varias viviendas, no de circuito individual, y requiere el nivel Tablero.",
};
