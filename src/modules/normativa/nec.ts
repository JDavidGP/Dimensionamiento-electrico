// src/modules/normativa/nec.ts
//
// Normativa BASE: NEC (EE.UU.). CIEN (Nicaragua) deriva de este archivo
// por referencia — ver cien.js. No se duplica ningún dato para CIEN acá;
// si algo se corrige en este archivo, CIEN lo hereda automáticamente.

import {
  AMPACIDAD_60C_POR_AWG,
  AREA_MM2_POR_AWG,
  REACTANCIA_OHM_KM_POR_AWG,
  ORDEN_AWG,
} from "../../shared/data/seccionesConductor.js";
import {
  TABLA_220_55_COL_A as TABLA_220_55_COL_A_CRUDA,
  NOTA1_220_55_UMBRAL_KW,
  NOTA1_220_55_PCT_POR_KW,
} from "../../shared/data/tiposEquipoNEC.js";

const TABLA_220_55_COL_A: Record<number, number> = TABLA_220_55_COL_A_CRUDA;
import { CANALIZACION_NEC } from "./canalizacionNEC.ts";
import type { Normativa, ReglaDemanda } from "./tipos.ts";

// Breakers estándar NEC 240.6(A) — CONFIRMADO: el propio texto del CIEN
// (Artículo 240-6) lista exactamente estos mismos valores hasta 200A,
// palabra por palabra. No es una referencia prestada, es el texto oficial.
const BREAKERS_NEC = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200];

// --- Factor de corrección por temperatura ambiente (referencia 30°C) ---
function factorTemperatura(tempC: number): number {
  if (tempC <= 30) return 1.0;
  if (tempC <= 35) return 0.94;
  if (tempC <= 40) return 0.88;
  if (tempC <= 45) return 0.82;
  if (tempC <= 50) return 0.75;
  if (tempC <= 55) return 0.67;
  return 0.58;
}

// ---------------------------------------------------------------------------
// Reglas de demanda (Art. 220 / 422 / 430 / 440). Cada función recibe las
// potencias del grupo YA ajustadas por continuidad (1.25x si aplica) y
// devuelve la demanda del grupo en W. El motor de demanda (factorDemanda.js)
// no conoce ningún artículo específico — solo llama a estas funciones.
// ---------------------------------------------------------------------------

/** Art. 220.42 — alumbrado general: 100% primeros 3kVA, 35% hasta 120kVA, 25% resto. */
const demandaIluminacion: ReglaDemanda = (potenciasW) => {
  const vaTotal = potenciasW.reduce((s, p) => s + p, 0);
  if (vaTotal <= 0) return 0;
  if (vaTotal <= 3000) return vaTotal;
  if (vaTotal <= 120000) return 3000 + (vaTotal - 3000) * 0.35;
  return 3000 + (120000 - 3000) * 0.35 + (vaTotal - 120000) * 0.25;
};

/** Art. 220.53 — 4 o más equipos fijos de pequeño electrodoméstico: 75%. */
const demandaPequenoElectrodomestico: ReglaDemanda = (potenciasW) => {
  const total = potenciasW.reduce((s, p) => s + p, 0);
  return potenciasW.length >= 4 ? total * 0.75 : total;
};

/**
 * Art. 220.55 — cocinas eléctricas.
 * Columna A base (≤12kW/unidad). Nota 1: si el promedio nominal > 12kW,
 * sumar 5% por cada kW (o fracción) de exceso al valor de tabla.
 */
const demandaCocinaElectrica: ReglaDemanda = (potenciasW) => {
  const n = potenciasW.length;
  if (n === 0) return 0;

  const totalKw = potenciasW.reduce((s, p) => s + p, 0) / 1000;
  const promedioKw = totalKw / n;

  // Hasta 25 unidades: tabla oficial. Más de 25: 25kW base + 1kW por
  // unidad adicional (aproximación de la Col. A extendida).
  let demandaTablaKw = n <= 25 ? TABLA_220_55_COL_A[n] : TABLA_220_55_COL_A[25] + (n - 25);

  if (promedioKw > NOTA1_220_55_UMBRAL_KW) {
    const fracciones = Math.ceil(promedioKw - NOTA1_220_55_UMBRAL_KW); // cada kW o fracción
    demandaTablaKw *= 1 + fracciones * NOTA1_220_55_PCT_POR_KW;
  }

  // La demanda no puede superar la carga conectada total
  return Math.min(demandaTablaKw * 1000, totalKw * 1000);
};

/**
 * Art. 220.54 — secadoras de ropa.
 * 1-4 unidades: 100% del nombreplate (mín. 5kW c/u si no se indica).
 * 5+: 100% de las 4 primeras + 15% de cada adicional (simplificación
 * de la tabla 220.54 Col. A para uso en circuitos derivados).
 */
const demandaSecadora: ReglaDemanda = (potenciasW) => {
  const n = potenciasW.length;
  if (n === 0) return 0;
  const ajustadas = potenciasW.map((p) => Math.max(p, 5000));
  if (n <= 4) return ajustadas.reduce((s, p) => s + p, 0);
  const primeras4 = ajustadas.slice(0, 4).reduce((s, p) => s + p, 0);
  const resto = ajustadas.slice(4).reduce((s, p) => s + p, 0);
  return primeras4 + resto * 0.15;
};

/** Art. 430.24 — varios motores: 125% del mayor + 100% del resto. */
const demandaMotores: ReglaDemanda = (potenciasW) => {
  if (potenciasW.length === 0) return 0;
  const [mayor, ...resto] = [...potenciasW].sort((a, b) => b - a);
  return mayor * 1.25 + resto.reduce((s, p) => s + p, 0);
};

/** Sin tabla de diversidad propia: 100% de la suma. Usada como fallback. */
const demanda100: ReglaDemanda = (potenciasW) => {
  return potenciasW.reduce((s, p) => s + p, 0);
};

// Mapa tipoEquipoNEC -> regla de demanda. Cualquier tipo no listado acá
// (AIRE_ACONDICIONADO, CALEFACCION_AGUA, CARGA_GENERAL, u otro) cae en
// demandaPorDefecto (ver más abajo).
const reglasDemanda: Record<string, ReglaDemanda> = {
  ILUMINACION_GENERAL: demandaIluminacion,
  PEQUENO_ELECTRODOMESTICO: demandaPequenoElectrodomestico,
  COCINA_ELECTRICA: demandaCocinaElectrica,
  SECADORA_ROPA: demandaSecadora,
  MOTOR: demandaMotores,
};

export const NEC: Normativa = {
  id: "NEC",
  nombre: "NEC (EE.UU. — referencia regional Centroamérica)",
  familia: "NEC",
  unidadSeccion: "AWG",
  ordenSecciones: ORDEN_AWG,
  areaMm2PorSeccion: AREA_MM2_POR_AWG,
  ampacidad: AMPACIDAD_60C_POR_AWG,
  reactanciaOhmKm: REACTANCIA_OHM_KM_POR_AWG,
  breakersComerciales: BREAKERS_NEC,
  limiteCaidaTensionPct: 3.0,
  voltajesPorFase: { mono: [120], bi: [240], tri: [208, 240, 480] },
  factorTemperatura,
  reglasDemanda,
  demandaPorDefecto: demanda100,
  // Llenado de conducto (NEC Cap. 9) — dato opcional del contrato por ahora
  // (no todas las normativas lo tienen todavía, ver checklist). CIEN lo
  // hereda automático porque comparte esta tabla con NEC.
  canalizaciones: CANALIZACION_NEC,
  validado: true,
  notaValidacion: "Ampacidad verificada contra NEC 310.16 (columna 60°C) — coincide exactamente.",
};
