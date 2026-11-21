// src/modules/motor/proteccionTransformador.ts
//
// Protección de sobrecorriente del transformador — NEC (NFPA 70) Tabla
// 450.3(B), ≤1000V primario. Usuario, 2026-11-21: aportó la tabla con
// datos duros (documento subido) para conectar por primera vez
// calcularCorrientesNominales() (existía en transformador.js, pero
// nada en la app la llamaba) a un resultado de cálculo real.
//
// DISTINTA de seleccionarBreaker (breaker.js, para un circuito
// derivado): acá el % máximo permitido depende de la MAGNITUD de la
// corriente nominal (más margen relativo para corrientes chicas,
// porque un margen fijo se vuelve impráctico en amperajes bajos) y de
// qué ESQUEMA de protección se eligió — "solo primario" (un solo
// dispositivo, aguas arriba) o "primario + secundario" (protección en
// los dos devanados, típico cuando el secundario alimenta un tablero
// con su propio interruptor principal).
//
// Regla de redondeo: el "Nota 1" de la propia tabla NEC permite
// redondear HACIA ARRIBA al siguiente tamaño estándar cuando el 125%
// calculado no coincide exactamente con uno — las demás filas (167%,
// 250%, 300%) SIEMPRE redondean HACIA ABAJO (nunca exceder el % máximo
// permitido).
//
// Tabla 450.3(B) completa (primario ≤1000V):
//   Solo primario   | primario ≥9A   | 125% | redondea ARRIBA (Nota 1)
//   Solo primario   | primario 2-9A  | 167% | redondea ABAJO
//   Solo primario   | primario <2A   | 300% | redondea ABAJO
//   Primario+Secund.| primario (cualquiera) | 250% | redondea ABAJO
//   Primario+Secund.| secundario ≥9A | 125% | redondea ARRIBA (Nota 1)
//   Primario+Secund.| secundario <9A | 167% | redondea ABAJO
//
// Verificado contra el ejemplo numérico del propio documento: 75kVA
// 480V→208Y/120V trifásico → corriente primaria 90.2A, 250%→225.5A→
// disyuntor 225A; corriente secundaria 208.2A, 125%→260.2A→disyuntor
// 300A (Nota 1, redondeado hacia arriba porque 260.2 no es un tamaño
// estándar exacto) — ver test_proteccion_transformador.mjs.
//
// ALCANCE: NEC/CIEN únicamente (CIEN deriva de NEC, Art. 240-6 lista
// los mismos tamaños estándar). IEC_ES (REBT) usa su propio criterio
// por ITC-BT-47, no verificado todavía — no se aplica esta tabla ahí;
// llamar esta función para una instalación IEC_ES sería inventar un
// criterio que esa normativa no tiene documentado acá.

/**
 * Tamaños estándar NEC 240.6(A) — lista COMPLETA (a diferencia de
 * BREAKERS_NEC en normativa/nec.ts, que se corta a propósito en 200A
 * porque ahí modela breakers de circuito derivado/alimentador
 * residencial-comercial típico). La protección de un transformador de
 * cualquier tamaño necesita tamaños mayores (225A en adelante), de ahí
 * esta lista aparte en vez de extender la otra y arriesgar un cambio
 * de comportamiento en la selección de breaker de circuito.
 */
export const TAMANOS_ESTANDAR_NEC_240_6_A = [
  15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500, 600, 700, 800, 1000, 1200, 1600, 2000, 2500, 3000, 4000, 5000, 6000,
];

export type EsquemaProteccionTransformador = "solo_primario" | "primario_y_secundario";

export interface ParametrosProteccionTransformador {
  corrientePrimariaA: number;
  corrienteSecundariaA?: number | null;
  esquema: EsquemaProteccionTransformador;
  /** Lista de tamaños estándar a usar — por defecto, la tabla NEC 240.6(A) completa. Parametrizable por si una variante regional derivada tuviera su propia lista algún día. */
  tamanosEstandar?: number[];
}

export type ResultadoProteccionTransformador =
  | { ok: false; motivo: string }
  | {
      ok: true;
      proteccionPrimariaA: number;
      porcentajePrimario: number;
      proteccionSecundariaA: number | null;
      porcentajeSecundario: number | null;
    };

function masCercanoHaciaAbajo(valor: number, tamanos: number[]): number | null {
  const candidatos = tamanos.filter((t) => t <= valor);
  return candidatos.length ? Math.max(...candidatos) : null;
}

function masCercanoHaciaArriba(valor: number, tamanos: number[]): number | null {
  const candidatos = tamanos.filter((t) => t >= valor);
  return candidatos.length ? Math.min(...candidatos) : null;
}

/** Devuelve, para una corriente y un % ya elegidos, el tamaño estándar redondeado en la dirección que pide la tabla — o null si ningún tamaño de la lista alcanza. */
function aplicarPorcentaje(corrienteA: number, porcentaje: number, direccion: "arriba" | "abajo", tamanosEstandar: number[]): number | null {
  const limite = corrienteA * (porcentaje / 100);
  return direccion === "arriba" ? masCercanoHaciaArriba(limite, tamanosEstandar) : masCercanoHaciaAbajo(limite, tamanosEstandar);
}

export function seleccionarProteccionTransformador({
  corrientePrimariaA,
  corrienteSecundariaA = null,
  esquema,
  tamanosEstandar = TAMANOS_ESTANDAR_NEC_240_6_A,
}: ParametrosProteccionTransformador): ResultadoProteccionTransformador {
  if (!(corrientePrimariaA > 0)) {
    return { ok: false, motivo: "Falta la corriente nominal primaria del transformador." };
  }

  if (esquema === "solo_primario") {
    const porcentaje = corrientePrimariaA >= 9 ? 125 : corrientePrimariaA >= 2 ? 167 : 300;
    const direccion = porcentaje === 125 ? "arriba" : "abajo";
    const proteccionPrimariaA = aplicarPorcentaje(corrientePrimariaA, porcentaje, direccion, tamanosEstandar);
    if (proteccionPrimariaA == null) {
      return { ok: false, motivo: `Ningún tamaño estándar de la lista cubre el ${porcentaje}% de ${corrientePrimariaA.toFixed(1)}A — se necesita un tamaño mayor al listado.` };
    }
    return { ok: true, proteccionPrimariaA, porcentajePrimario: porcentaje, proteccionSecundariaA: null, porcentajeSecundario: null };
  }

  // primario_y_secundario
  if (!(corrienteSecundariaA! > 0)) {
    return { ok: false, motivo: "Falta la corriente nominal secundaria del transformador para el esquema primario + secundario." };
  }

  const proteccionPrimariaA = aplicarPorcentaje(corrientePrimariaA, 250, "abajo", tamanosEstandar);
  if (proteccionPrimariaA == null) {
    return { ok: false, motivo: `Ningún tamaño estándar de la lista cubre el 250% de ${corrientePrimariaA.toFixed(1)}A (primario) — se necesita un tamaño mayor al listado.` };
  }

  const porcentajeSecundario = corrienteSecundariaA! >= 9 ? 125 : 167;
  const direccionSecundario = porcentajeSecundario === 125 ? "arriba" : "abajo";
  const proteccionSecundariaA = aplicarPorcentaje(corrienteSecundariaA!, porcentajeSecundario, direccionSecundario, tamanosEstandar);
  if (proteccionSecundariaA == null) {
    return { ok: false, motivo: `Ningún tamaño estándar de la lista cubre el ${porcentajeSecundario}% de ${corrienteSecundariaA}A (secundario) — se necesita un tamaño mayor al listado.` };
  }

  return { ok: true, proteccionPrimariaA, porcentajePrimario: 250, proteccionSecundariaA, porcentajeSecundario };
}
