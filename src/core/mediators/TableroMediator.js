/**
 * TableroMediator
 * Responsabilidad: dominio Tablero — dato relacional puro (Fase 3) +
 * alimentador (Fase 4: longitud, material, fases, tableroPadreId).
 * CERO gráfico: eso es DiagramaMediator (Fase 6), que consumirá este
 * dato más adelante pero es un dominio distinto.
 *
 * NO implementa (todavía) la lógica de encadenar tableroPadreId hacia
 * arriba (subpaneles, jerarquía, detección de ciclos) — es el
 * siguiente paso, no esta sesión.
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
  editarTablero,
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

  /**
   * Devuelve el tablero editado; el hook decide cómo guardarlo. Un
   * tableroPadreId que apunta al propio tablero se ignora (no tiene
   * sentido físico) — la validación de padre inexistente la hace
   * ValidacionMediator sobre el modelo guardado.
   */
  editar(tablero, cambios) {
    let cambiosFinal = cambios;
    if (cambios.tableroPadreId && cambios.tableroPadreId === tablero.id) {
      Logger.warn("TableroMediator.editar: tableroPadreId no puede ser el propio tablero, se ignora", {
        id: tablero.id,
      });
      cambiosFinal = { ...cambios, tableroPadreId: tablero.tableroPadreId };
    }
    return editarTablero(tablero, cambiosFinal);
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
   *
   * Acepta overrides explícitos (circuitos/resultados/normativaId/
   * tablero), todos opcionales — llamarlo solo con tableroId funciona
   * exactamente igual que antes (cae al DataProvider). Los overrides
   * existen porque el snapshot del DataProvider se sincroniza en un
   * useEffect que corre DESPUÉS del render: si la UI llama a este
   * método durante el render con datos recién cambiados (tableros/
   * circuitos/resultados), el DataProvider todavía tiene el snapshot
   * del render anterior. Pasando los valores frescos se evita ese
   * desfase de un render.
   */
  calcularAlimentador(tableroId, { circuitos, resultados, normativaId, tablero } = {}) {
    const t = tablero ?? DataProvider.getTablero(tableroId);
    if (!t) {
      return { ok: false, error: `Tablero ${tableroId} no existe.` };
    }

    const circuitosDelTablero = circuitosDeTablero(tableroId, circuitos ?? DataProvider.getCircuitos());
    const listaResultados = resultados ?? DataProvider.getResultados();
    const resultadosDelTablero = circuitosDelTablero
      .map((c) => listaResultados.find((r) => r.id === c.id))
      .filter(Boolean);

    const normativa = NormativaMediator.obtener(normativaId ?? DataProvider.getNormativaActivaId());
    if (!normativa) {
      return { ok: false, error: "Normativa activa no resuelta." };
    }

    return calcularAlimentador(t, resultadosDelTablero, t.fases, normativa);
  },
};
