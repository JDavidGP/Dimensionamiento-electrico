// src/shared/data/canalizacionREBT.js
//
// ITC-BT-21 (REBT, RD 842/2002) — "Instalaciones interiores o
// receptoras. Tubos y canales protectoras". Tablas 2 y 5, extraídas
// directamente del texto oficial (Ministerio de Ciencia y Tecnología,
// https://www.plcmadrid.es/documentos-rebt/ITC-21.pdf, páginas 3-6),
// verificadas por `pdftotext -layout` contra el PDF real — usuario,
// 2026-11-24, "llenado de conducto para REBT".
//
// A diferencia de NEC (llenado por % de área, ver canalizacion.ts),
// ITC-BT-21 da directamente el DIÁMETRO EXTERIOR mínimo del tubo por
// tabla, según sección del conductor y cantidad (1 a 5 conductores
// unipolares de IGUAL sección). Dos tablas, una por tipo de
// instalación del tubo — DAN DIÁMETROS DISTINTOS, no son la misma
// tabla con otro nombre:
//   - Tabla 2: canalizaciones SUPERFICIALES (tubo visto, sobre pared).
//   - Tabla 5: canalizaciones EMPOTRADAS (dentro de pared/techo/obra —
//     la más común en vivienda española).
//
// Para MÁS DE 5 conductores por tubo, o conductores/cables de secciones
// DIFERENTES en el mismo tubo, el propio texto NO da una tabla — exige
// que "su sección interior será, como mínimo, igual a 2,5 [superficial]
// / 3 [empotrada] veces la sección ocupada por los conductores", y el
// diámetro INTERIOR de cada tubo comercial "será facilitado por el
// fabricante" (no está normalizado en la ITC). Por eso ese caso NO se
// calcula acá — no hay con qué, sin inventar un diámetro interior que
// el fabricante no declaró — se reporta explícito que hace falta el
// dato del fabricante, mismo criterio que canalizacion.ts.
//
// Claves de sección en mm² (conductores unipolares aislados), cada
// valor es un array de 5 diámetros exteriores en mm, para 1..5
// conductores de esa sección en el mismo tubo.
export const TABLA_DIAMETRO_TUBO_REBT = {
  superficial: {
    "1.5": [12, 12, 16, 16, 16],
    "2.5": [12, 12, 16, 16, 20],
    "4": [12, 16, 20, 20, 20],
    "6": [12, 16, 20, 20, 25],
    "10": [16, 20, 25, 32, 32],
    "16": [16, 25, 32, 32, 32],
    "25": [20, 32, 32, 40, 40],
    "35": [25, 32, 40, 40, 50],
    "50": [25, 40, 50, 50, 50],
    "70": [32, 40, 50, 63, 63],
    "95": [32, 50, 63, 63, 75],
    "120": [40, 50, 63, 75, 75],
    "150": [40, 63, 75, 75, null],
    "185": [50, 63, 75, null, null],
    "240": [50, 75, null, null, null],
  },
  empotrada: {
    "1.5": [12, 12, 16, 16, 20],
    "2.5": [12, 16, 20, 20, 20],
    "4": [12, 16, 20, 20, 25],
    "6": [12, 16, 25, 25, 25],
    "10": [16, 25, 25, 32, 32],
    "16": [20, 25, 32, 32, 40],
    "25": [25, 32, 40, 40, 50],
    "35": [25, 40, 40, 50, 50],
    "50": [32, 40, 50, 50, 63],
    "70": [32, 50, 63, 63, 63],
    "95": [40, 50, 63, 75, 75],
    "120": [40, 63, 75, 75, null],
    "150": [50, 63, 75, null, null],
    "185": [50, 75, null, null, null],
    "240": [63, 75, null, null, null],
  },
};

// Orden real de la tabla (coincide con las filas del texto oficial) —
// para iterar/validar secciones sin depender del orden de las claves
// del objeto.
export const ORDEN_SECCIONES_REBT = ["1.5", "2.5", "4", "6", "10", "16", "25", "35", "50", "70", "95", "120", "150", "185", "240"];

// "Para más de 5 conductores por tubo o para conductores o cables de
// secciones diferentes a instalar en el mismo tubo, su sección interior
// será, como mínimo, igual a 2,5 [superficial] / 3 [empotrada] veces la
// sección ocupada por los conductores." — cita literal de ITC-BT-21,
// Tablas 2 y 5 respectivamente. Expuesto para mostrar la regla en la
// UI (no para calcular un diámetro — ver nota de cabecera).
export const MULTIPLICADOR_SECCION_INTERIOR_MINIMO = {
  superficial: 2.5,
  empotrada: 3,
};

export const TIPOS_INSTALACION_TUBO_REBT = Object.keys(TABLA_DIAMETRO_TUBO_REBT);
