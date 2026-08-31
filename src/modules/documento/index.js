/**
 * Módulo Documento — stub.
 * Reportes PDF / memoria técnica aún no implementados.
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

export function generarMemoriaTecnica() {
  return {
    ok: false,
    error: "Memoria técnica PDF aún no implementada (DocumentoMediator stub).",
  };
}
