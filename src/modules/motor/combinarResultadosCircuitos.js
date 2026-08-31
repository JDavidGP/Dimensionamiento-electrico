// Combina la demanda de varios circuitos YA CALCULADOS (resultados de
// calcularCircuito) en una potencia y cos φ agregados — mismo principio
// que combinarCargas() usa para equipos dentro de un circuito, aplicado
// un nivel más arriba (a nivel tablero).
//
// PROVISIONAL: suma lineal de potencias de demanda (P) sin factor de
// diversidad de alimentador propio (ese factor es un refinamiento
// normativo distinto al de circuito derivado — ver conversación de
// diseño). Documentado a propósito como aproximación, no como resultado
// final.
export function combinarResultadosCircuitos(resultados) {
  const validos = resultados.filter((r) => r?.ok);

  if (validos.length === 0) {
    return { potenciaTotalW: 0, cosPhiCombinado: 1, cantidadCircuitos: 0 };
  }

  let p = 0;
  let q = 0;
  for (const r of validos) {
    const pCircuito = r.cargaDemandaNormativaW;
    const phi = Math.acos(r.cosPhiEfectivo);
    p += pCircuito;
    q += pCircuito * Math.tan(phi);
  }

  const s = Math.sqrt(p * p + q * q);
  const cosPhiCombinado = s > 0 ? p / s : 1;

  return { potenciaTotalW: p, cosPhiCombinado, cantidadCircuitos: validos.length };
}
