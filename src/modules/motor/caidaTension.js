// Caída de tensión, considerando resistencia (r) y reactancia (x) del
// conductor — fórmula aproximada estándar para cargas con factor de
// potencia distinto de 1 (motores, cargas inductivas).
export function calcularCaidaTension({ corrienteA, distanciaM, r, x, cosPhi, voltajeV, fases }) {
  const phi = Math.acos(cosPhi);
  const zEfectivo = (r / 1000) * cosPhi + (x / 1000) * Math.sin(phi);

  const deltaV =
    fases === "tri"
      ? Math.sqrt(3) * distanciaM * corrienteA * zEfectivo
      : 2 * distanciaM * corrienteA * zEfectivo;

  const porcentaje = (deltaV / voltajeV) * 100;

  return { deltaV, porcentaje };
}
