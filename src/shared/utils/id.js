// Genera un ID único para cada equipo/circuito. Usa crypto.randomUUID()
// si está disponible (navegadores modernos); si no, un fallback simple
// basado en timestamp + número aleatorio, suficiente para distinguir
// elementos dentro de una misma sesión.
export function generarId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
