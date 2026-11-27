/**
 * EtiquetadoMediator
 * Responsabilidad: dominio Etiquetado — sugiere el código corto
 * (autogenerado con jerarquía, ej. "TD1-C3") de un tablero/circuito/
 * equipo nuevo (ver modules/etiquetado/index.js para el porqué de este
 * dominio). El listado consolidado que antes armaba este mediador para
 * "Directorio" quedó obsoleto cuando esa pestaña pasó a ser un árbol
 * plegable armado directamente en PanelDirectorio.jsx a partir de los
 * datos crudos (tableros/circuitos/equipos/nodosDiagrama/plano) — ya
 * no hay un paso intermedio de "listado" que este mediador arme.
 *
 * NO muta el proyecto — solo lectura/sugerencia, igual criterio que el
 * resto de los mediadores de dominio.
 */
import { sugerirEtiquetaTablero, sugerirEtiquetaCircuito, sugerirEtiquetaEquipo } from "../../modules/etiquetado/index.ts";

export const EtiquetadoMediator = {
  sugerirTablero(tableros?: Parameters<typeof sugerirEtiquetaTablero>[0]): string {
    return sugerirEtiquetaTablero(tableros);
  },

  sugerirCircuito(tableroEtiqueta: Parameters<typeof sugerirEtiquetaCircuito>[0], circuitosDelTablero?: Parameters<typeof sugerirEtiquetaCircuito>[1]): string {
    return sugerirEtiquetaCircuito(tableroEtiqueta, circuitosDelTablero);
  },

  sugerirEquipo(circuitoEtiqueta: Parameters<typeof sugerirEtiquetaEquipo>[0], equiposDelCircuito?: Parameters<typeof sugerirEtiquetaEquipo>[1]): string {
    return sugerirEtiquetaEquipo(circuitoEtiqueta, equiposDelCircuito);
  },
};
