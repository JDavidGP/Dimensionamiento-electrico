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
import { sugerirEtiquetaTablero, sugerirEtiquetaCircuito, sugerirEtiquetaEquipo } from "../../modules/etiquetado/index.js";

export const EtiquetadoMediator = {
  sugerirTablero(tableros) {
    return sugerirEtiquetaTablero(tableros);
  },

  sugerirCircuito(tableroEtiqueta, circuitosDelTablero) {
    return sugerirEtiquetaCircuito(tableroEtiqueta, circuitosDelTablero);
  },

  sugerirEquipo(circuitoEtiqueta, equiposDelCircuito) {
    return sugerirEtiquetaEquipo(circuitoEtiqueta, equiposDelCircuito);
  },
};
