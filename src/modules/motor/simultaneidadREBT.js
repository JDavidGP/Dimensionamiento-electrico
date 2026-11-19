// Coeficiente de simultaneidad REBT ITC-BT-10 ("Previsión de cargas
// para suministros en baja tensión") — España, RD 842/2002.
//
// VERIFICADO (2026-11-19) contra el texto oficial de la instrucción y
// la Guía-BT-10 del Ministerio de Ciencia y Tecnología (Edición sep03,
// Revisión 1) — dos fuentes independientes, Tabla 1 IDÉNTICA en ambas:
//   - https://www.plcmadrid.es/wp-content/uploads/ITC-BT-10.pdf
//   - https://www.plcmadrid.es/wp-content/uploads/guia_bt_10_sep03R1.pdf
// Descargados y leídos directamente (no de memoria ni de un resumen de
// búsqueda) tras habilitar esos dominios en el entorno.
//
// Aplica a un conjunto de VIVIENDAS que comparten una misma acometida
// (ej. un edificio de apartamentos) — NO a locales comerciales,
// oficinas, garajes ni servicios generales, que ITC-BT-10 exige sumar
// SIEMPRE al 100% (coeficiente de simultaneidad = 1), sin excepción.
// Por eso ese caso no necesita código nuevo: ya es el comportamiento
// por defecto de este programa (suma lineal) cuando simultaneidadREBT
// no está activo en un tablero.

/**
 * Tabla 1 — coeficiente de simultaneidad según el número de viviendas.
 * n=1..21 tabulado tal cual el documento oficial; n>21 usa su propia
 * fórmula (ver coeficienteSimultaneidad).
 */
export const TABLA_COEFICIENTE_SIMULTANEIDAD = {
  1: 1, 2: 2, 3: 3, 4: 3.8, 5: 4.6, 6: 5.4, 7: 6.2, 8: 7, 9: 7.8, 10: 8.5,
  11: 9.2, 12: 9.9, 13: 10.6, 14: 11.3, 15: 11.9, 16: 12.5, 17: 13.1,
  18: 13.7, 19: 14.3, 20: 14.8, 21: 15.3,
};

/**
 * Coeficiente de simultaneidad para n viviendas. n>21 usa la fórmula
 * del propio documento: 15,3 + (n-21)·0,5 — confirmada en ambas
 * fuentes, no extrapolada por este programa.
 * @returns {number|null} null si n no es un entero ≥1 (dato inválido, no se inventa un valor)
 */
export function coeficienteSimultaneidad(n) {
  if (!Number.isInteger(n) || n < 1) return null;
  if (n <= 21) return TABLA_COEFICIENTE_SIMULTANEIDAD[n];
  return 15.3 + (n - 21) * 0.5;
}

/**
 * Grados de electrificación (ITC-BT-10 §2.1/§2.2) — potencia MÍNIMA a
 * prever quien no conoce la demanda real de una vivienda. "elevada" se
 * exige si hay previsión de electrodomésticos por encima de básica,
 * calefacción eléctrica, aire acondicionado, superficie >160 m², o
 * infraestructura de recarga de vehículo eléctrico en unifamiliar (o
 * cualquier combinación) — este programa NO intenta detectar esas
 * condiciones automáticamente (no modela superficie/electrodomésticos
 * por vivienda); el usuario elige el grado.
 */
export const GRADOS_ELECTRIFICACION = {
  BASICA: { id: "basica", potenciaMinimaW: 5750 },
  ELEVADA: { id: "elevada", potenciaMinimaW: 9200 },
};

export function potenciaMinimaGrado(grado) {
  return grado === "elevada" ? GRADOS_ELECTRIFICACION.ELEVADA.potenciaMinimaW : GRADOS_ELECTRIFICACION.BASICA.potenciaMinimaW;
}

/**
 * Carga del conjunto de viviendas (ITC-BT-10 §3.1): media aritmética de
 * las potencias máximas previstas por vivienda, × el coeficiente de
 * simultaneidad de la Tabla 1 según n.
 * @param {number[]} potenciasW - potencia prevista (W) de cada vivienda, una entrada por vivienda
 * @returns {{ok:true, n:number, coeficiente:number, mediaW:number, cargaW:number} | {ok:false, motivo:string}}
 */
export function calcularCargaSimultaneaViviendas(potenciasW) {
  if (!Array.isArray(potenciasW) || potenciasW.length === 0) {
    return { ok: false, motivo: "Sin viviendas para calcular la carga simultánea." };
  }
  const n = potenciasW.length;
  const coeficiente = coeficienteSimultaneidad(n);
  if (coeficiente == null) {
    return { ok: false, motivo: `Número de viviendas inválido (${n}).` };
  }
  const mediaW = potenciasW.reduce((s, p) => s + p, 0) / n;
  return { ok: true, n, coeficiente, mediaW, cargaW: mediaW * coeficiente };
}

export const SIMULTANEIDAD_REBT_VACIA = { activa: false, gradoPorDefecto: GRADOS_ELECTRIFICACION.BASICA.id };

/**
 * Normaliza tablero.simultaneidadREBT antes de guardarlo — mismo
 * criterio que normalizarConmutacion (modules/origen/conmutacion.js):
 * defaults seguros, nunca un valor inválido guardado tal cual.
 */
export function normalizarSimultaneidadREBT(datos = {}) {
  return {
    activa: Boolean(datos.activa),
    gradoPorDefecto: Object.values(GRADOS_ELECTRIFICACION).some((g) => g.id === datos.gradoPorDefecto)
      ? datos.gradoPorDefecto
      : GRADOS_ELECTRIFICACION.BASICA.id,
  };
}
