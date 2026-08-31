import { potenciaDesdeCorriente } from "./corriente.js";

// Resuelve la potencia real de un equipo dentro de un circuito. Si el
// equipo se ingresó como corriente, necesita el voltaje/fases del
// CIRCUITO al que pertenece (no los guarda el equipo — un circuito
// mixto es un solo voltaje físico, no tiene sentido que cada equipo
// tenga el suyo).
export function potenciaDeEquipo(equipo, circuito) {
  const unitaria =
    equipo.modoEntrada === "corriente"
      ? potenciaDesdeCorriente(equipo.valor, circuito.voltaje, circuito.fases, equipo.cosPhi)
      : equipo.valor;
  return unitaria * (equipo.cantidad && equipo.cantidad > 0 ? equipo.cantidad : 1);
}

// Combina varios equipos (con distinto cos φ cada uno) en la potencia y
// el factor de potencia EFECTIVO del circuito completo — usando potencia
// activa (P) y reactiva (Q), no un promedio simple de cos φ, que sería
// físicamente incorrecto.
//
// P_total = Σ P_i
// Q_total = Σ P_i · tan(φ_i)
// cos φ_efectivo = P_total / √(P_total² + Q_total²)
export function combinarCargas(equipos, circuito) {
  let potenciaTotal = 0;
  let reactivaTotal = 0;

  for (const e of equipos) {
    const p = potenciaDeEquipo(e, circuito);
    const cosPhi = Math.min(Math.max(e.cosPhi ?? 1, 0.01), 1);
    const phi = Math.acos(cosPhi);
    potenciaTotal += p;
    reactivaTotal += p * Math.tan(phi);
  }

  const aparente = Math.sqrt(potenciaTotal ** 2 + reactivaTotal ** 2);
  const cosPhiEfectivo = aparente > 0 ? potenciaTotal / aparente : 1;

  return { potenciaTotal, reactivaTotal, cosPhiEfectivo };
}
