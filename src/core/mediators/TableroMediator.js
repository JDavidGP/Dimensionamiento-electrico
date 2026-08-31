/**
 * TableroMediator
 * Responsabilidad: dominio Tablero — dato relacional puro (Fase 3).
 * CERO gráfico: eso es DiagramaMediator (Fase 6), que consumirá este
 * dato más adelante pero es un dominio distinto.
 *
 * Dependencias permitidas: DataProvider (lectura), funciones internas
 * del módulo tablero, y — desde Fase 4 (alimentador) — la función pura
 * calcularAlimentador de modules/motor + NormativaMediator para
 * resolver la normativa activa. Mismo precedente que ya usan
 * MotorCalculoMediator y ValidacionMediator con NormativaMediator: el
 * mediador SÍ puede cruzar dominios, es lo que lo distingue de un
 * módulo puro. Lo que sigue prohibido: UI, Documento, Diagrama.
 *
 * Igual que Motor/Normativa: NO muta el proyecto. Devuelve datos ya
 * calculados/transformados; la escritura real (setCircuitos/setTableros)
 * la hace la capa de aplicación (hook), como con Circuito y Equipo.
 */
import {
  crearTablero,
  circuitosDeTablero,
  circuitosSinTablero,
  asignarCircuitoATablero,
  liberarCircuitosDeTablero,
} from "../../modules/tablero/index.js";
import { calcularAlimentador } from "../../modules/motor/index.js";
import { DataProvider } from "../services/DataProvider.js";
import { NormativaMediator } from "./NormativaMediator.js";
import { Logger } from "../services/Logger.js";

export const TableroMediator = {
  /** Fábrica de un tablero nuevo (no lo guarda — eso lo hace el hook). */
  crear(datos) {
    return crearTablero(datos);
  },

  listar() {
    return DataProvider.getTableros();
  },

  obtener(id) {
    return DataProvider.getTablero(id);
  },

  /** Circuitos que pertenecen a un tablero (lectura calculada, no una segunda copia). */
  circuitosDe(tableroId, circuitos) {
    return circuitosDeTablero(tableroId, circuitos ?? DataProvider.getCircuitos());
  },

  sinAsignar(circuitos) {
    return circuitosSinTablero(circuitos ?? DataProvider.getCircuitos());
  },

  /** Devuelve el circuito actualizado; el hook decide cómo guardarlo. */
  asignar(circuito, tableroId) {
    if (tableroId && !DataProvider.getTablero(tableroId)) {
      Logger.warn("TableroMediator.asignar: tableroId no existe", { tableroId });
    }
    return asignarCircuitoATablero(circuito, tableroId);
  },

  desasignar(circuito) {
    return asignarCircuitoATablero(circuito, null);
  },

  /** Al borrar un tablero, libera (no borra) los circuitos que le pertenecían. */
  liberarCircuitos(tableroId, circuitos) {
    return liberarCircuitosDeTablero(tableroId, circuitos ?? DataProvider.getCircuitos());
  },

  /**
   * Dimensiona el tramo troncal (alimentador) de un tablero, a partir
   * de la demanda agregada de sus circuitos YA CALCULADOS (lee
   * DataProvider.getResultados(), no dispara el motor en cadena — mismo
   * anti-ciclo que ya respeta ValidacionMediator).
   * PROVISIONAL: ver nota en modules/motor/calcularAlimentador.js.
   */
  calcularAlimentador(tableroId) {
    const tablero = DataProvider.getTablero(tableroId);
    if (!tablero) {
      return { ok: false, error: `Tablero ${tableroId} no existe.` };
    }

    const circuitos = circuitosDeTablero(tableroId, DataProvider.getCircuitos());
    const resultados = DataProvider.getResultados();
    const resultadosDelTablero = circuitos
      .map((c) => resultados.find((r) => r.id === c.id))
      .filter(Boolean);

    const normativa = NormativaMediator.obtener(DataProvider.getNormativaActivaId());
    if (!normativa) {
      return { ok: false, error: "Normativa activa no resuelta." };
    }

    return calcularAlimentador(tablero, resultadosDelTablero, tablero.fases, normativa);
  },
};
