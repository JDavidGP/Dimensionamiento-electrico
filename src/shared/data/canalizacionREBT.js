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

// --- Instalación enterrada (usuario, 2026-11-25, "canalizaciones
// aéreas y subterráneas") — ITC-BT-07 (redes subterráneas) + ITC-BT-19
// Tabla B (factor de agrupación de tubos enterrados). Datos tomados
// directamente del resumen normativo que aportó el usuario, no de la
// tabla 2/5 de arriba (esas son para tubo superficial/empotrado, no
// enterrado — ITC-BT-21 enumera una Tabla 9 propia para enterrado, pero
// sin los valores de diámetro en mano no se fabrica esa tabla: por eso
// acá NO hay un diametroMinimoTuboEnterradoREBT, solo lo que sigue, que
// sí tiene dato real detrás.

/** ITC-BT-07, condiciones generales — profundidad mínima según dónde pasa la zanja, en metros. */
export const PROFUNDIDAD_MINIMA_ENTERRADA_REBT_M = {
  acera: 0.6,
  calzada: 0.8,
};

/** ITC-BT-07 — protección mecánica (losetas o cinta de señalización) exigida a esta altura sobre el cable directamente enterrado, en metros. */
export const PROTECCION_MECANICA_ALTURA_REBT_M = 0.25;

/** ITC-BT-07 — separación mínima con otras canalizaciones de servicios, en metros. */
export const SEPARACION_MINIMA_OTRAS_CANALIZACIONES_REBT_M = {
  general: 0.2,
  gas_alta_presion: 0.4,
};

// ITC-BT-19, Tabla B — factor de corrección por agrupación de tubos
// enterrados (un cable por tubo), según cantidad de cables y separación
// entre tubos. A partir de 1 m de separación, factor 1,00 (sin
// corrección) — por eso esa columna no hace falta tabularla aparte,
// alcanza con tratar "≥1m" como el propio 1,00 en el código que la lee.
// Filas EXACTAMENTE las que publica la norma (no están todos los
// enteros 2-20, hay saltos a 12/16/20) — un conteo intermedio se
// resuelve en el código que la usa, nunca interpolando acá.
export const TABLA_FACTOR_AGRUPACION_TUBOS_REBT = [
  { cables: 2, contacto: 0.8, m025: 0.88, m050: 0.95, m100: 1.0 },
  { cables: 3, contacto: 0.71, m025: 0.8, m050: 0.88, m100: 0.95 },
  { cables: 4, contacto: 0.65, m025: 0.71, m050: 0.8, m100: 0.88 },
  { cables: 5, contacto: 0.6, m025: 0.65, m050: 0.71, m100: 0.8 },
  { cables: 6, contacto: 0.58, m025: 0.6, m050: 0.65, m100: 0.71 },
  { cables: 7, contacto: 0.55, m025: 0.58, m050: 0.6, m100: 0.65 },
  { cables: 8, contacto: 0.53, m025: 0.55, m050: 0.58, m100: 0.6 },
  { cables: 9, contacto: 0.5, m025: 0.53, m050: 0.55, m100: 0.58 },
  { cables: 12, contacto: 0.45, m025: 0.5, m050: 0.53, m100: 0.55 },
  { cables: 16, contacto: 0.4, m025: 0.45, m050: 0.5, m100: 0.53 },
  { cables: 20, contacto: 0.35, m025: 0.4, m050: 0.45, m100: 0.5 },
];
