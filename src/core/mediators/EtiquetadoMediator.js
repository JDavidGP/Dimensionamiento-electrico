/**
 * EtiquetadoMediator
 * Responsabilidad: dominio Etiquetado — código corto + función de cada
 * objeto (tablero/circuito/equipo), y el listado consolidado para el
 * "Directorio" (ver modules/etiquetado/index.js para el porqué de este
 * dominio). Cruza tableros/circuitos/equipos para armar el listado —
 * permitido a nivel mediador, mismo patrón que DocumentoMediator
 * cruzando Tablero/Origen/Normativa (ver ARCHITECTURE.md §11).
 *
 * NO muta el proyecto — solo lectura/sugerencia, igual criterio que el
 * resto de los mediadores de dominio.
 */
import { sugerirEtiquetaTablero, sugerirEtiquetaCircuito, sugerirEtiquetaEquipo, listaDirectorio } from "../../modules/etiquetado/index.js";

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

  directorio(datos) {
    return listaDirectorio(datos);
  },
};
