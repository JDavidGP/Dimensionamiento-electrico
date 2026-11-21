// Dimensionamiento del ALIMENTADOR de un tablero: el tramo troncal que
// lo conecta hacia arriba (acometida u otro tablero). Reusa la misma
// selección de sección/breaker que un circuito derivado — la física es
// idéntica, cambia qué corriente lo atraviesa (la agregada del tablero,
// no la de un equipo).
//
// PROVISIONAL: la corriente agregada viene de combinarResultadosCircuitos
// (suma lineal, sin factor de diversidad de alimentador propio).
import { calcularCorriente } from "./corriente.ts";
import { seleccionarSeccion } from "./seleccionSeccion.ts";
import { seleccionarBreaker } from "./breaker.ts";
import { combinarResultadosCircuitos } from "./combinarResultadosCircuitos.ts";
import type { Tablero, Fases, ResultadoCircuito } from "./tipos.ts";
import type { Normativa } from "../normativa/tipos.ts";

export type ResultadoAlimentador =
  | { ok: false; error: string }
  | { ok: false; pendiente: true; sinCircuitos: true; motivo: string }
  | { ok: false; pendiente: true; motivo: string }
  | {
      ok: false;
      potenciaTotalW: number;
      cosPhiCombinado: number;
      corrienteDiseno: number;
      cantidadCircuitos: number;
      error: string;
    }
  | {
      ok: true;
      potenciaTotalW: number;
      cosPhiCombinado: number;
      corrienteDiseno: number;
      cantidadCircuitos: number;
      seccion: string;
      unidadSeccion: string;
      areaMm2: number;
      ampacidadCorregida: number;
      caidaPct: number;
      breaker: number | null;
      advertencias: string[];
      notaDimensionamiento: string;
    };

/**
 * @param tablero - { longitudAlimentador, materialAlimentador, tensionAlimentacion }
 * @param resultadosCircuitos - resultados YA calculados de los circuitos de ese tablero
 * @param fases - "mono" | "bi" | "tri" (el tramo troncal puede ser trifásico aunque los circuitos sean mono)
 * @param normativa - normativa activa ya resuelta
 * @param temp - temperatura ambiente del tramo troncal
 */
export function calcularAlimentador(
  tablero: Tablero,
  resultadosCircuitos: (ResultadoCircuito | null | undefined)[],
  fases: Fases | string,
  normativa: Normativa,
  temp: number = 30
): ResultadoAlimentador {
  if (!normativa || typeof normativa !== "object") {
    return { ok: false, error: "Normativa no inyectada." };
  }

  const { potenciaTotalW, cosPhiCombinado, cantidadCircuitos } = combinarResultadosCircuitos(resultadosCircuitos);

  if (cantidadCircuitos === 0) {
    // sinCircuitos (además de pendiente): distingue ESTE caso puntual —
    // "no tiene circuitos propios todavía" — de cualquier otro motivo
    // de pendiente (ej. falta la longitud del alimentador más abajo, o
    // un hijo propio incompleto). TableroMediator.calcularAlimentadorAgregado
    // lo usa para decidir si puede aplicar el grado de electrificación
    // mínimo de ITC-BT-10 como respaldo (solo tiene sentido cuando lo
    // que falta es la demanda real, no cualquier otro dato roto).
    return { ok: false, pendiente: true, sinCircuitos: true, motivo: "Sin circuitos calculados asignados a este tablero todavía." };
  }

  const distanciaM = Number(tablero.longitudAlimentador);
  if (!distanciaM || distanciaM <= 0) {
    return { ok: false, pendiente: true, motivo: "Falta la longitud del alimentador." };
  }

  const material = (tablero.materialAlimentador || "cobre").toLowerCase();
  const tensionV = Number(tablero.tensionAlimentacion);

  const corrienteDiseno = calcularCorriente(potenciaTotalW, tensionV, fases, cosPhiCombinado);

  const seleccion = seleccionarSeccion({
    corrienteA: corrienteDiseno,
    distanciaM,
    cosPhi: cosPhiCombinado,
    material,
    fases,
    temp,
    voltajeV: tensionV,
    normativa,
  });

  if (!seleccion) {
    return {
      ok: false,
      potenciaTotalW,
      cosPhiCombinado,
      corrienteDiseno,
      cantidadCircuitos,
      error: `Ningún calibre de ${material} cumple ampacidad y caída de tensión (≤${normativa.limiteCaidaTensionPct}%) para ${corrienteDiseno.toFixed(
        2
      )}A a ${distanciaM}m bajo ${normativa.nombre}. Es una aproximación provisional (suma lineal, sin diversidad de alimentador).`,
    };
  }

  const { breaker, advertencia } = seleccionarBreaker(corrienteDiseno, seleccion.ampacidadCorregida, normativa.breakersComerciales);

  return {
    ok: true,
    potenciaTotalW,
    cosPhiCombinado,
    corrienteDiseno,
    cantidadCircuitos,
    seccion: seleccion.seccion,
    unidadSeccion: normativa.unidadSeccion,
    areaMm2: seleccion.areaMm2,
    ampacidadCorregida: seleccion.ampacidadCorregida,
    caidaPct: seleccion.caidaPct,
    breaker,
    advertencias: advertencia ? [advertencia] : [],
    notaDimensionamiento:
      "PROVISIONAL: suma lineal de la demanda de los circuitos asignados, sin factor de diversidad de alimentador propio.",
  };
}
