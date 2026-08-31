/**
 * Motor de factor de demanda — agrupa equipos por tipo y aplica la regla
 * de demanda de la NORMATIVA ACTIVA a cada grupo.
 *
 * Este módulo NO conoce ningún artículo específico (220.42, 430.24, etc.):
 * esas fórmulas viven en el archivo de cada normativa (ver
 * src/data/normativas/nec.js -> reglasDemanda). Acá solo se orquesta:
 * agrupar, aplicar continuidad, delegar la demanda del grupo a la regla
 * que la normativa activa tenga para ese tipo (o a su demandaPorDefecto
 * si no tiene una propia).
 *
 * REGLA DURA:
 *   - El conductor y el breaker se dimensionan SIEMPRE sobre cargaDemandaNormativaW.
 *   - cargaEstimadaUsoW es solo informativa (factor de simultaneidad de campo).
 *   - Continuidad (1.25) se aplica por equipo ANTES de agrupar por tipo.
 *
 * Los tres factores no se mezclan en el mismo campo:
 *   (a) demanda normativa  → dimensiona
 *   (b) continuidad        → por equipo, dentro del grupo
 *   (c) simultaneidad campo → solo referencia
 */

import { FACTOR_CARGA_CONTINUA } from "../../shared/constants/constantes.js";
import { potenciaDeEquipo } from "./cargaCombinada.js";

/**
 * Potencia de un equipo lista para demanda:
 *   1) potencia real (W o convertida desde A)
 *   2) × 1.25 si esCargaContinua
 */
function potenciaParaDemanda(equipo, circuito) {
  const p = potenciaDeEquipo(equipo, circuito);
  return equipo.esCargaContinua ? p * FACTOR_CARGA_CONTINUA : p;
}

/**
 * Calcula las tres cargas del documento para un circuito, bajo la
 * normativa activa.
 *
 * @param {object} normativa - normativa resuelta (de NORMATIVAS[id]),
 *   debe traer reglasDemanda y demandaPorDefecto.
 * @returns {{
 *   cargaConectadaW: number,
 *   cargaDemandaNormativaW: number,
 *   cargaEstimadaUsoW: number,
 *   detallePorTipo: Array<{ tipo: string, conectadaW: number, demandaW: number, cantidad: number }>,
 *   advertencias: string[]
 * }}
 */
export function calcularCargasDemanda(circuito, equipos, normativa) {
  const advertencias = [];
  const cargaConectadaW = equipos.reduce((s, e) => s + potenciaDeEquipo(e, circuito), 0);

  // Agrupar por tipoEquipoNEC
  const grupos = new Map();
  for (const e of equipos) {
    const tipo = e.tipoEquipoNEC || "CARGA_GENERAL";
    if (!grupos.has(tipo)) grupos.set(tipo, []);
    grupos.get(tipo).push(e);
  }

  let cargaDemandaNormativaW = 0;
  const detallePorTipo = [];

  for (const [tipo, eqs] of grupos) {
    const potenciasConectadas = eqs.map((e) => potenciaDeEquipo(e, circuito));
    const potenciasConContinuidad = eqs.map((e) => potenciaParaDemanda(e, circuito));
    const conectadaGrupo = potenciasConectadas.reduce((s, p) => s + p, 0);

    const reglaGrupo = normativa.reglasDemanda[tipo] ?? normativa.demandaPorDefecto;
    const demandaGrupo = reglaGrupo(potenciasConContinuidad);

    // Advertencia de datos incompletos para motores — no es una regla de
    // demanda en sí (no cambia el resultado), es un aviso de completitud
    // de datos útil sin importar la normativa activa.
    if (tipo === "MOTOR") {
      for (const e of eqs) {
        if (e.corrienteRotorBloqueado == null || !(e.corrienteRotorBloqueado > 0)) {
          advertencias.push(
            `Motor "${e.nombre}": no se registró corriente de rotor bloqueado (opcional para arranque, Art. 430).`
          );
        }
      }
    }

    cargaDemandaNormativaW += demandaGrupo;
    detallePorTipo.push({
      tipo,
      conectadaW: conectadaGrupo,
      demandaW: demandaGrupo,
      cantidad: eqs.length,
    });
  }

  // Factor de simultaneidad de campo — SOLO informativo
  const fs =
    circuito.tipo === "mixto" && equipos.length > 1 && circuito.factorSimultaneidadManual != null
      ? Math.min(Math.max(Number(circuito.factorSimultaneidadManual), 0), 1)
      : 1.0;

  const cargaEstimadaUsoW = cargaDemandaNormativaW * fs;

  return {
    cargaConectadaW,
    cargaDemandaNormativaW,
    cargaEstimadaUsoW,
    factorSimultaneidadAplicado: fs,
    detallePorTipo,
    advertencias,
  };
}
