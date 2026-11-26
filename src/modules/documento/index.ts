/**
 * Módulo Documento — API interna.
 * La UI no importa esto directamente; usa DocumentoMediator.
 */
export { generarMemoriaTecnica, resumenMaterialesPorCalibre } from "./memoriaTecnica.ts";
export type {
  Circuito,
  Equipo,
  Tablero,
  ResultadoCircuito,
  AlimentadorResultado,
  DatosMemoriaTecnica,
  FilaCircuito,
  FilaTablero,
  MemoriaTecnica,
  EntradaIntegridad,
  NormativaResuelta,
  TipoInstalacionResuelto,
  Totales,
  ResumenMaterialCalibre,
} from "./tipos.ts";
