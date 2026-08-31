export function redondear(valor, decimales = 2) {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

export function formatearAmperios(valor) {
  return `${redondear(valor, 2)} A`;
}

export function formatearPorcentaje(valor) {
  return `${redondear(valor, 2)}%`;
}
