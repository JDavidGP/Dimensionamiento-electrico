/**
 * Módulo Diagrama — stub.
 * Editor unifilar / topología aún no implementados.
 */
export function obtenerTopologia(circuitos = [], equipos = []) {
  return {
    nodos: circuitos.map((c) => ({ id: c.id, tipo: "circuito", nombre: c.nombre })),
    enlaces: equipos.map((e) => ({
      from: e.circuitoId,
      to: e.id,
      tipo: "equipo",
    })),
    generacion: "stub",
  };
}
