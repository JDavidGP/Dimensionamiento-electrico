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
 *
 * DECISIÓN (investigada, no arbitraria): circuito.factorSimultaneidadManual
 * queda MANUAL, sin tabla por normativa — a diferencia de reglasDemanda,
 * que sí tiene tabla porque hay artículo específico por tipo de equipo.
 * Se evaluó agregar una tabla de simultaneidad al contrato de normativa
 * (mismo patrón que demandaPorDefecto) y no hay fuente que la respalde
 * a nivel de UN circuito:
 *   - NEC Art. 220 ya tiene sus propias tablas de diversidad/demanda por
 *     tipo de equipo — son justamente reglasDemanda de arriba. Duplicar
 *     eso acá como "tabla de simultaneidad" sería inventar una segunda
 *     fuente para el mismo número, o reimplementar 220.42/53/54/55 con
 *     otro nombre.
 *   - La simultaneidad real de REBT (España, ITC-BT-10) sí existe como
 *     tabla oficial, pero opera sobre el ALIMENTADOR/TABLERO (varias
 *     viviendas compartiendo acometida), no sobre un circuito individual
 *     — ver modules/motor/simultaneidadREBT.ts + TableroMediator.
 *     calcularAlimentadorAgregado. No es lo mismo que este campo.
 * Mientras no exista una tabla oficial a nivel de circuito, el número lo
 * sigue poniendo el usuario (buen juicio de campo: cuántos equipos de un
 * circuito mixto realmente coinciden en uso), nunca dimensiona, y por
 * eso normativa/index.js NO lo agrega a CAMPOS_OBLIGATORIOS.
 */

import { FACTOR_CARGA_CONTINUA } from "../../shared/constants/constantes.ts";
import { potenciaDeEquipo } from "./cargaCombinada.ts";
import type { Equipo, Circuito, DetalleDemandaTipo } from "./tipos.ts";
import type { Normativa } from "../normativa/tipos.ts";

/**
 * Potencia de un equipo lista para demanda:
 *   1) potencia real (W o convertida desde A)
 *   2) × 1.25 si esCargaContinua
 */
function potenciaParaDemanda(equipo: Equipo, circuito: Circuito): number {
  const p = potenciaDeEquipo(equipo, circuito);
  return equipo.esCargaContinua ? p * FACTOR_CARGA_CONTINUA : p;
}

export interface CargasDemanda {
  cargaConectadaW: number;
  cargaDemandaNormativaW: number;
  cargaEstimadaUsoW: number;
  factorSimultaneidadAplicado: number;
  detallePorTipo: DetalleDemandaTipo[];
  advertencias: string[];
}

/**
 * Calcula las tres cargas del documento para un circuito, bajo la
 * normativa activa.
 *
 * @param normativa - normativa resuelta (de NORMATIVAS[id]), debe traer reglasDemanda y demandaPorDefecto.
 */
export function calcularCargasDemanda(circuito: Circuito, equipos: Equipo[], normativa: Normativa): CargasDemanda {
  const advertencias: string[] = [];
  const cargaConectadaW = equipos.reduce((s, e) => s + potenciaDeEquipo(e, circuito), 0);

  // Agrupar por tipoEquipoNEC
  const grupos = new Map<string, Equipo[]>();
  for (const e of equipos) {
    const tipo = e.tipoEquipoNEC || "CARGA_GENERAL";
    if (!grupos.has(tipo)) grupos.set(tipo, []);
    grupos.get(tipo)!.push(e);
  }

  let cargaDemandaNormativaW = 0;
  const detallePorTipo: DetalleDemandaTipo[] = [];

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
