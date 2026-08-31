// Selecciona el breaker comercial más pequeño que cubre la corriente de
// diseño, sin exceder la ampacidad corregida del conductor.
// `breakersComerciales` viene de la normativa activa (NEC, IEC, etc.) —
// cada una tiene su propia lista de tamaños estándar disponibles.
//
// CORRECCIÓN APLICADA (ver informe técnico v0.6): la versión original en
// Kotlin devolvía el breaker más pequeño de la lista (15A) como fallback
// silencioso cuando ningún breaker comercial cumplía ambas condiciones —
// es decir, podía "aprobar" un breaker que en realidad excedía la
// ampacidad del conductor. Esta versión distingue explícitamente ese caso
// y devuelve una advertencia en vez de un valor incorrecto.
export function seleccionarBreaker(corrienteDiseno, ampacidadCorregida, breakersComerciales) {
  const minimoParaLaCarga =
    breakersComerciales.find((b) => b >= corrienteDiseno) ??
    breakersComerciales[breakersComerciales.length - 1];

  if (minimoParaLaCarga <= ampacidadCorregida) {
    return { breaker: minimoParaLaCarga, advertencia: null };
  }

  const dentroDeAmpacidad = breakersComerciales.filter((b) => b <= ampacidadCorregida);

  if (dentroDeAmpacidad.length === 0) {
    return {
      breaker: null,
      advertencia: `Ningún breaker comercial es seguro: la ampacidad corregida (${ampacidadCorregida.toFixed(
        1
      )}A) es menor al breaker mínimo estándar (${breakersComerciales[0]}A). Se requiere conductor más grueso.`,
    };
  }

  const maxSeguro = Math.max(...dentroDeAmpacidad);
  return {
    breaker: maxSeguro,
    advertencia: `Breaker limitado a ${maxSeguro}A por ampacidad del conductor (la carga pediría ${minimoParaLaCarga}A).`,
  };
}
