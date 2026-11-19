// Sección transversal de cada calibre AWG, en mm² — es lo que conecta el
// sistema americano (AWG, para NEC) con el sistema métrico (mm², para
// IEC/CIEN). Con esta área + la resistividad del material, la resistencia
// se calcula, no se busca en una tabla fija — así el mismo cálculo sirve
// para cualquier sección, incluidas las mm² estándar de IEC más adelante.
export const AREA_MM2_POR_AWG = {
  "14": 2.08,
  "12": 3.31,
  "10": 5.26,
  "8": 8.37,
  "6": 13.3,
  "4": 21.2,
  "3": 26.7,
  "2": 33.6,
  "1": 42.4,
  "1/0": 53.5,
  "2/0": 67.4,
  "3/0": 85.0,
  "4/0": 107.2,
  "250": 126.7, // kcmil (1 kcmil = 0.5067 mm²) — típico de acometida/alimentador principal
  "300": 152.0,
  "350": 177.3,
  "400": 202.7,
  "500": 253.4,
};

// Reactancia inductiva aproximada (Ω/km) — a diferencia de la resistencia,
// la reactancia no se deriva de un área simple (depende del espaciado
// entre conductores y la geometría de la canalización), así que se
// mantiene como tabla de referencia aproximada por calibre.
export const REACTANCIA_OHM_KM_POR_AWG = {
  "14": 0.15,
  "12": 0.14,
  "10": 0.13,
  "8": 0.12,
  "6": 0.11,
  "4": 0.1,
  "3": 0.1,
  "2": 0.09,
  "1": 0.09,
  "1/0": 0.08,
  "2/0": 0.08,
  "3/0": 0.08,
  "4/0": 0.08,
  "250": 0.07,
  "300": 0.07,
  "350": 0.07,
  "400": 0.07,
  "500": 0.07,
};

// Ampacidad de referencia (columna 60°C, NEC 310.16 / renombrada Tabla
// 310.15(B)(16) en ediciones recientes) — el rango 14 a 2/0 ya estaba
// validado (coincide exactamente con la tabla oficial).
//
// EXTENSIÓN (calibres de acometida/alimentador, 3/0 a 500 kcmil):
// spot-check COMPLETADO (cobre Y aluminio, columna 60°C) — no quedó
// pendiente ningún cambio de valores, los de abajo ya eran correctos.
// Metodología (sin acceso directo al texto NFPA 70, que es de pago):
//   1. El usuario subió un PDF de referencia con la tabla completa
//      3/0–500 kcmil (cobre y aluminio, columnas 60/75/90°C + área,
//      diámetro y resistencia). El PDF en sí NO es una fuente primaria
//      confiable — su formato (encabezado tipo página web, pie "Page X
//      of Y", y sobre todo una "Nota de verificación" final que narra
//      en primera persona lo que "quedó confirmado" en el documento)
//      indica que fue compilado/generado, no escaneado del código
//      real. Se trató como una fuente secundaria más, a contrastar.
//   2. Se comparó cada valor del PDF contra este archivo Y contra
//      búsqueda web independiente (WebSearch, sesión del 2026-11-19).
//   3. Cobre 3/0–500 kcmil: 100% de coincidencia entre el PDF, este
//      archivo y las fuentes web — sin discrepancias.
//   4. Aluminio 3/0–500 kcmil: 6 de 7 valores coincidieron. Única
//      discrepancia: 300 kcmil a 60°C — el PDF decía 195A, este
//      archivo ya tenía 190A. Se verificó con dos fuentes web
//      independientes (PES Supply, e IEWC — hoja de especificación que
//      cita explícitamente "2023 NEC Table 310.16" — ambas coherentes
//      entre sí en 75°C=230A/90°C=260A, y dan 190A en 60°C): el PDF
//      subido estaba equivocado en esa celda: el valor correcto es
//      190A, que es el que ya tenía este archivo. No se cambió nada.
//   5. Bonus fuera del rango pendiente: el mismo PDF también traía mal
//      el aluminio 8 AWG a 60°C (decía 35A); el valor correcto es 30A
//      (confirmado vía reproducción de Border States), que es el que
//      ya tenía este archivo. Confirma que el PDF subido, aunque
//      mayormente correcto, no es confiable por sí solo como cita.
// Pendiente real que sigue abierto: la Tabla 310.12 (servicio de
// vivienda), anotado aparte en la ruta guía — no tiene relación con
// este spot-check.
export const AMPACIDAD_60C_POR_AWG = {
  cobre: {
    "14": 15, "12": 20, "10": 30, "8": 40, "6": 55, "4": 70,
    "3": 85, "2": 95, "1": 110, "1/0": 125, "2/0": 145,
    "3/0": 165, "4/0": 195, "250": 215, "300": 240, "350": 260, "400": 280, "500": 320,
  },
  aluminio: {
    "10": 25, "8": 30, "6": 40, "4": 55, "3": 65, "2": 75,
    "1": 85, "1/0": 100, "2/0": 115,
    "3/0": 130, "4/0": 150, "250": 170, "300": 190, "350": 210, "400": 225, "500": 260,
  },
};

// Orden explícito de más delgado a más grueso — JavaScript reordena
// automáticamente llaves de objeto que parecen enteros, así que NO se
// debe recorrer con Object.keys(). Ver nota en calcularCircuito.js.
export const ORDEN_AWG = {
  cobre: ["14", "12", "10", "8", "6", "4", "3", "2", "1", "1/0", "2/0", "3/0", "4/0", "250", "300", "350", "400", "500"],
  aluminio: ["10", "8", "6", "4", "3", "2", "1", "1/0", "2/0", "3/0", "4/0", "250", "300", "350", "400", "500"],
};
