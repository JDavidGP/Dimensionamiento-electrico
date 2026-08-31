// Resistividad eléctrica de referencia a 20°C (Ω·mm²/m) — valores físicos
// estándar (cobre recocido 100% IACS, aluminio serie 8000 aprox.), no
// dependen de ninguna normativa específica.
export const RESISTIVIDAD_20C = {
  cobre: 0.017241,
  aluminio: 0.028264,
};

// Coeficiente de temperatura de la resistividad (por °C), referencia 20°C.
export const COEFICIENTE_TEMPERATURA = {
  cobre: 0.00393,
  aluminio: 0.00403,
};

// Temperatura de OPERACIÓN asumida del conductor (no la ambiente) para el
// cálculo de caída de tensión — es una convención estándar de diseño
// (NEC/IEC calculan caída de tensión asumiendo el conductor a su
// temperatura nominal de trabajo, típicamente 75°C con aislamiento THHN/
// THWN). Esto es DISTINTO del factor de corrección por temperatura
// ambiente, que afecta la ampacidad, no la resistencia usada para caída
// de tensión — son dos correcciones físicas separadas, no deben mezclarse.
export const TEMP_OPERACION_CONDUCTOR_C = 75;
