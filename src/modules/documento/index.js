/**
 * Módulo Documento — API interna.
 * La UI no importa esto directamente; usa DocumentoMediator.
 */
export function generarResumenCalculos(resultados = []) {
  return {
    ok: true,
    tipo: "resumen",
    cantidadCircuitos: resultados.length,
    okCount: resultados.filter((r) => r.ok).length,
    generacion: "stub",
  };
}

export { generarMemoriaTecnica } from "./memoriaTecnica.js";
