/**
 * Módulo Validación — API interna.
 * La UI no importa esto directamente; usa ValidacionMediator.
 */
export {
  validarIntegridadReferencial,
  ESTADOS as ESTADOS_REFERENCIAL,
  peorEstado,
} from "./referencial.ts";
export {
  validarIntegridadElectrica,
  ESTADOS as ESTADOS_ELECTRICA,
  localizarNodo,
} from "./electrica.ts";
export {
  validarCircuito,
  formularioACircuito,
  circuitoAFormulario,
  validarEquipo,
  formularioAEquipo,
  equipoAFormulario,
} from "./formularios.ts";

import { validarIntegridadReferencial, ESTADOS } from "./referencial.ts";
import { validarIntegridadElectrica } from "./electrica.ts";
import type { Circuito, Equipo, Tablero, FuenteEnergia, Transformador, NodoDiagrama, MarcadorEquipoPlano, Proyecto } from "./tipos.ts";
import type { OpcionesValidarCircuitoElectrico } from "./electrica.ts";
import type { Entrada } from "./referencial.ts";

export function obtenerListaIntegridad(
  proyecto: Proyecto | null | undefined,
  circuitos: Circuito[] = [],
  equipos: Equipo[] = [],
  tableros: Tablero[] = [],
  fuentesEnergia: FuenteEnergia[] = [],
  nodosDiagrama: NodoDiagrama[] = [],
  transformadores: Transformador[] = [],
  marcadoresEquipoPlano: MarcadorEquipoPlano[] = []
): Entrada[] {
  return validarIntegridadReferencial(proyecto, circuitos, equipos, tableros, fuentesEnergia, nodosDiagrama, transformadores, marcadoresEquipoPlano);
}

export function obtenerDetalleElectrico(
  id: string,
  proyecto: Proyecto | null | undefined,
  circuitos: Circuito[] = [],
  equipos: Equipo[] = [],
  opts: OpcionesValidarCircuitoElectrico = {}
) {
  return validarIntegridadElectrica(id, proyecto, circuitos, equipos, opts);
}

export function resumenIntegridad(
  proyecto: Proyecto | null | undefined,
  circuitos: Circuito[] = [],
  equipos: Equipo[] = [],
  tableros: Tablero[] = [],
  fuentesEnergia: FuenteEnergia[] = [],
  nodosDiagrama: NodoDiagrama[] = [],
  transformadores: Transformador[] = [],
  marcadoresEquipoPlano: MarcadorEquipoPlano[] = []
): Record<"ok" | "advertencia" | "error", number> {
  const lista = validarIntegridadReferencial(proyecto, circuitos, equipos, tableros, fuentesEnergia, nodosDiagrama, transformadores, marcadoresEquipoPlano);
  return lista.reduce(
    (acc, entrada) => {
      acc[entrada.estado] = (acc[entrada.estado] || 0) + 1;
      return acc;
    },
    { ok: 0, advertencia: 0, error: 0 }
  );
}

export { ESTADOS };
export type { Circuito, Equipo, Tablero, FuenteEnergia, Transformador, NodoDiagrama, MarcadorEquipoPlano, Proyecto, Estado } from "./tipos.ts";
export type { Entrada } from "./referencial.ts";
export type { ReporteElectrico, OpcionesValidarCircuitoElectrico, NodoLocalizado } from "./electrica.ts";
export type { FormularioCircuito, FormularioEquipo } from "./formularios.ts";
