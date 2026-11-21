/**
 * Orquestador interno del motor — NO consulta normativas por ID.
 * Recibe el objeto normativa ya resuelto (lo inyecta MotorCalculoMediator
 * vía NormativaMediator). Así el motor no conoce el catálogo de normativas.
 */
import { calcularCorriente } from "./corriente.ts";
import { seleccionarBreaker } from "./breaker.ts";
import { combinarCargas } from "./cargaCombinada.ts";
import { calcularCargasDemanda } from "./factorDemanda.ts";
import { seleccionarSeccion } from "./seleccionSeccion.ts";
import { claseCircuitoREBT } from "./claseCircuitoREBT.ts";
import type { Circuito, Equipo, ResultadoCircuito } from "./tipos.ts";
import type { Normativa } from "../normativa/tipos.ts";

/** Lo que el llamador (MotorCalculoMediator) sabe del circuito que el motor por sí solo no sabe — contexto de instalación para el límite de caída de tensión de normativas que lo necesitan (REBT); ignorado por NEC/CIEN. */
export interface ContextoInstalacionCircuito {
  tipoInstalacion?: string;
  tieneTransformadorPropio?: boolean;
}

/**
 * Dimensionamiento de UN circuito.
 *
 * REGLA DURA (factor de demanda):
 *   - conductor y breaker se calculan sobre cargaDemandaNormativaW
 *   - cargaEstimadaUsoW es solo informativa
 *   - cos φ efectivo sigue saliendo de las cargas conectadas (P+jQ)
 *   - caída de tensión se evalúa con la corriente de demanda normativa
 *     (diseño), no con la estimada de uso
 */
export function calcularCircuito(circuito: Circuito, equipos: Equipo[], normativa: Normativa, contextoInstalacion: ContextoInstalacionCircuito = {}): ResultadoCircuito {
  if (!normativa || typeof normativa !== "object") {
    return {
      ok: false,
      id: circuito?.id,
      nombre: circuito?.nombre,
      error: "Normativa no inyectada — use MotorCalculoMediator.calcularCircuito()",
    };
  }
  const fases = circuito.fases.toLowerCase();
  const material = circuito.material.toLowerCase();

  const advertencias: string[] = [];

  // Límite de caída de tensión del TRAMO propio de este circuito — un
  // número fijo para NEC/CIEN, pero dependiente del contexto para REBT
  // (ITC-BT-19 §2.2.2: tipo de instalación, alumbrado/otros usos,
  // transformador propio — ver normativa.limiteCaidaTensionTramoPct en
  // iec/es.ts). Si la normativa no define ese override, se usa el
  // limiteCaidaTensionPct de siempre — CERO cambio para NEC/CIEN.
  const claseCircuito = claseCircuitoREBT(equipos);
  const limiteCaidaTensionPct = normativa.limiteCaidaTensionTramoPct
    ? normativa.limiteCaidaTensionTramoPct({
        tipoInstalacion: contextoInstalacion.tipoInstalacion ?? "",
        claseCircuito,
        tieneTransformadorPropio: contextoInstalacion.tieneTransformadorPropio ?? false,
      })
    : normativa.limiteCaidaTensionPct;
  const normativaEfectiva: Normativa = limiteCaidaTensionPct === normativa.limiteCaidaTensionPct ? normativa : { ...normativa, limiteCaidaTensionPct };

  if (equipos.length === 0) {
    return {
      ok: false,
      id: circuito.id,
      nombre: circuito.nombre,
      error: "El circuito no tiene equipos asignados.",
    };
  }

  if (circuito.tipo === "dedicado" && equipos.length > 1) {
    advertencias.push(
      "Este circuito está marcado como DEDICADO pero tiene más de un equipo. Un circuito derivado individual (CIEN/NEC) debe alimentar un solo equipo — considera cambiarlo a 'mixto' o mover los equipos extra a otro circuito."
    );
  }

  // (a)+(b) demanda normativa + continuidad por equipo
  // (c) simultaneidad de campo → solo informativa
  const cargas = calcularCargasDemanda(circuito, equipos, normativa);
  advertencias.push(...cargas.advertencias);

  // cos φ efectivo a partir de las cargas conectadas reales (P + jQ)
  const { cosPhiEfectivo } = combinarCargas(equipos, circuito);

  // Corriente de diseño = la que dimensiona (demanda normativa)
  const corrienteDiseno = calcularCorriente(
    cargas.cargaDemandaNormativaW,
    circuito.voltaje,
    fases,
    cosPhiEfectivo
  );

  // Corriente “conectada” (sin demanda) — útil para mostrar y para ΔV de referencia
  const corrienteConectada = calcularCorriente(
    cargas.cargaConectadaW,
    circuito.voltaje,
    fases,
    cosPhiEfectivo
  );

  if (!normativa.validado) {
    advertencias.push(`Normativa ${normativa.nombre}: ${normativa.notaValidacion}`);
  }
  if (circuito.temp > 40) {
    advertencias.push(
      `Temperatura ambiente elevada (${circuito.temp}°C) — verificar factor contra la tabla oficial.`
    );
  }

  // Nota cuando se usa simultaneidad de campo
  if (
    circuito.tipo === "mixto" &&
    equipos.length > 1 &&
    circuito.factorSimultaneidadManual != null &&
    circuito.factorSimultaneidadManual < 1
  ) {
    advertencias.push(
      `Factor de simultaneidad de campo ${circuito.factorSimultaneidadManual}: solo afecta la carga estimada de uso. El conductor y el breaker se dimensionan sobre la demanda de ${normativa.id}.`
    );
  }

  const seleccion = seleccionarSeccion({
    corrienteA: corrienteDiseno,
    distanciaM: circuito.distancia,
    cosPhi: cosPhiEfectivo,
    material,
    fases,
    temp: circuito.temp,
    voltajeV: circuito.voltaje,
    normativa: normativaEfectiva,
  });

  if (seleccion) {
    const { seccion, areaMm2, caidaPct, ampacidadCorregida } = seleccion;
    const { breaker, advertencia } = seleccionarBreaker(
      corrienteDiseno,
      ampacidadCorregida,
      normativa.breakersComerciales
    );
    if (advertencia) advertencias.push(advertencia);

    return {
      ok: true,
      id: circuito.id,
      normativa: normativa.id,
      nombre: circuito.nombre,
      tipo: circuito.tipo,
      cantidadEquipos: equipos.length,
      // Tres cargas del documento
      potenciaTotal: cargas.cargaConectadaW, // alias histórico = conectada
      cargaConectadaW: cargas.cargaConectadaW,
      cargaDemandaNormativaW: cargas.cargaDemandaNormativaW,
      cargaEstimadaUsoW: cargas.cargaEstimadaUsoW,
      factorSimultaneidadAplicado: cargas.factorSimultaneidadAplicado,
      detalleDemanda: cargas.detallePorTipo,
      cosPhiEfectivo,
      corriente: corrienteDiseno, // la que dimensiona
      corrienteConectada,
      corrienteDiseno,
      seccion,
      unidadSeccion: normativa.unidadSeccion,
      areaMm2,
      ampacidadCorregida,
      caidaPct,
      breaker,
      claseCircuitoREBT: claseCircuito,
      advertencias,
      notaDimensionamiento: `Conductor y breaker calculados sobre carga de demanda ${normativa.id}, no sobre estimada de uso.`,
    };
  }

  return {
    ok: false,
    id: circuito.id,
    normativa: normativa.id,
    nombre: circuito.nombre,
    tipo: circuito.tipo,
    cargaConectadaW: cargas.cargaConectadaW,
    cargaDemandaNormativaW: cargas.cargaDemandaNormativaW,
    cargaEstimadaUsoW: cargas.cargaEstimadaUsoW,
    error: `Ningún calibre de ${material} cumple ampacidad y caída de tensión (≤${normativaEfectiva.limiteCaidaTensionPct}%) para ${corrienteDiseno.toFixed(
      2
    )}A a ${circuito.distancia}m bajo ${normativa.nombre}. Reduzca distancia, use trifásico, o conductor más grueso.`,
  };
}
