/**
 * TableroMediator
 * Responsabilidad: dominio Tablero — dato relacional puro (Fase 3) +
 * alimentador (Fase 4: longitud, material, fases, tableroPadreId).
 * CERO gráfico: eso es DiagramaMediator (Fase 6), que consumirá este
 * dato más adelante pero es un dominio distinto.
 *
 * caidaAcumuladaDesdeCircuito() encadena tableroPadreId hacia arriba
 * (hijo → padre, un solo camino: caída de tensión acumulada).
 * calcularAlimentadorAgregado() recorre hacia ABAJO (padre → hijos,
 * puede ramificarse): agrega la demanda de TODO el subárbol antes de
 * dimensionar el alimentador de un tablero. Son dos recorridos
 * distintos, cada uno con su propia detección de ciclos — no
 * confundir ni reusar la guarda del otro.
 *
 * Lo que sigue sin existir es la jerarquía VISUAL (lista de subpaneles
 * en la UI) — eso es un paso aparte, no esta sesión.
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
  obtenerCadenaAscendente,
  hijosDeTablero,
  obtenerArbolDescendentePostOrden,
} from "../../modules/tablero/index.js";
import { calcularAlimentador, evaluarCaidaAcumulada } from "../../modules/motor/index.js";
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

  /**
   * Caída de tensión ACUMULADA de un circuito, recorriendo la cadena de
   * tableros hacia arriba (su propio tablero → tableroPadreId → el
   * padre del padre → ... hasta la acometida). Suma VOLTIOS (no
   * porcentajes — cada tramo puede tener su propia tensión nominal) y
   * calcula el % final UNA sola vez, contra circuito.voltaje (la
   * tensión del punto de utilización). PROVISIONAL, ver
   * modules/motor/caidaTensionAcumulada.js.
   *
   * Contrato de retorno (el hook decide qué mostrar con cada caso):
   *   { aplica: false }                                    — nada que evaluar
   *   { aplica: true, ok: false, ciclo: true, error }       — jerarquía con ciclo
   *   { aplica: true, ok: false, noDeterminado: true, motivo } — falta un tramo
   *   { aplica: true, ok: false, tramoFallido: true, motivo }  — un tramo ya no cumple por sí solo
   *   { aplica: true, ok: true, deltaVTotal, totalPct, limitePct,
   *     excede, cantidadTramos, cantidadTableros }           — resultado completo
   *
   * FUERA DE ALCANCE (a propósito): transformadores / cambio de nivel
   * de tensión entre tramos, frecuencias distintas, subpanel con
   * alimentación mixta 120V/240V simultánea (depende de balance de
   * fases). Esta función asume una sola tensión de referencia válida
   * para toda la cadena.
   */
  caidaAcumuladaDesdeCircuito(circuito, { tableros, circuitos, resultados, normativaId, resultadoCircuito } = {}) {
    if (!circuito?.tableroId) {
      return { aplica: false };
    }
    if (!resultadoCircuito?.ok) {
      return { aplica: false };
    }

    const listaTableros = tableros ?? DataProvider.getTableros();
    const { cadena, ciclo } = obtenerCadenaAscendente(circuito.tableroId, listaTableros);

    if (ciclo) {
      const nombreInicio = listaTableros.find((t) => t.id === circuito.tableroId)?.nombre ?? circuito.tableroId;
      return {
        aplica: true,
        ok: false,
        ciclo: true,
        error: `Ciclo detectado en la jerarquía de tableros a partir de "${nombreInicio}" — revisá el tablero padre de esos tableros, nunca debería volver sobre sí mismo.`,
      };
    }

    if (cadena.length === 0) {
      // circuito.tableroId apunta a un tablero que no existe — dato
      // roto que ya reporta ValidacionMediator aparte; acá no hay
      // cadena real que recorrer, no se inventa un resultado.
      return { aplica: false };
    }

    const deltaVPorTramo = [Number(circuito.voltaje) * (resultadoCircuito.caidaPct / 100)];

    for (const tablero of cadena) {
      const alim = this.calcularAlimentador(tablero.id, { circuitos, resultados, normativaId, tablero });

      if (!alim.ok) {
        if (alim.pendiente) {
          return {
            aplica: true,
            ok: false,
            noDeterminado: true,
            motivo: `Tablero "${tablero.nombre}": ${alim.motivo}`,
          };
        }
        return {
          aplica: true,
          ok: false,
          tramoFallido: true,
          motivo: `Tablero "${tablero.nombre}" ya no cumple su propio límite de tramo (3%) por separado: ${alim.error}`,
        };
      }

      deltaVPorTramo.push(Number(tablero.tensionAlimentacion) * (alim.caidaPct / 100));
    }

    const evaluacion = evaluarCaidaAcumulada(deltaVPorTramo, Number(circuito.voltaje));

    return {
      aplica: true,
      ok: true,
      ...evaluacion,
      cantidadTableros: cadena.length,
    };
  },

  /**
   * Dimensiona el alimentador de `tableroId` agregando la demanda de
   * TODO su subárbol: sus circuitos propios + la demanda YA CALCULADA
   * de cada uno de sus tableros hijos (que a su vez agregan la de los
   * suyos, recursivamente — puede haber varias ramas, no un solo
   * camino, ver obtenerArbolDescendentePostOrden).
   *
   * Un tablero solo se puede calcular cuando TODOS sus hijos ya se
   * calcularon — por eso se resuelve el subárbol completo en orden
   * post-orden (hijos antes que el padre) y se memoiza en `agregados`,
   * nunca se recalcula un tablero dos veces.
   *
   * Reusa la función pura calcularAlimentador SIN tocarla: la demanda
   * de cada hijo ya calculado se adapta a la forma que espera
   * combinarResultadosCircuitos (cargaDemandaNormativaW, cosPhiEfectivo)
   * y se mezcla con los resultados reales de los circuitos propios —
   * el motor no distingue si una demanda vino de un circuito o de un
   * tablero hijo, es la misma física agregada.
   *
   * Contrato de retorno (mismo criterio que calcularAlimentador):
   *   { ok: false, ciclo: true, error }            — ciclo padre→hijos
   *   { ok: false, pendiente: true, motivo }        — falta un tramo del
   *                                                    subárbol por calcular
   *   { ok: false, error }                          — un tramo del
   *                                                    subárbol ya no cumple, o tableroId no existe
   *   { ok: true, potenciaTotalW, cosPhiCombinado,
   *     seccion, breaker, caidaPct, ... }           — igual forma que
   *                                                    calcularAlimentador
   *
   * FUERA DE ALCANCE a propósito (ver módulo origen y
   * caidaTensionAcumulada.js): transformadores, cambio de nivel de
   * tensión, balance de fases, subtablero con alimentación mixta
   * 120V/240V simultánea.
   */
  calcularAlimentadorAgregado(tableroId, { tableros, circuitos, resultados, normativaId } = {}) {
    const listaTableros = tableros ?? DataProvider.getTableros();
    const { orden, ciclo, tableroCiclo } = obtenerArbolDescendentePostOrden(tableroId, listaTableros);

    if (ciclo) {
      return {
        ok: false,
        ciclo: true,
        error: `Ciclo detectado en la jerarquía de tableros al bajar por los hijos de "${tableroCiclo?.nombre ?? tableroId}" — revisá el tablero padre de esos tableros, nunca debería volver sobre sí mismo.`,
      };
    }

    if (orden.length === 0) {
      return { ok: false, error: `Tablero ${tableroId} no existe.` };
    }

    const normativa = NormativaMediator.obtener(normativaId ?? DataProvider.getNormativaActivaId());
    if (!normativa) {
      return { ok: false, error: "Normativa activa no resuelta." };
    }

    const listaCircuitos = circuitos ?? DataProvider.getCircuitos();
    const listaResultados = resultados ?? DataProvider.getResultados();
    const agregados = {}; // tableroId -> resultado ya calculado (memo, se llena en post-orden)

    for (const t of orden) {
      const hijos = hijosDeTablero(t.id, listaTableros);
      const hijoIncompleto = hijos.find((h) => !agregados[h.id]?.ok);

      if (hijoIncompleto) {
        // Nunca se suma 0 y se sigue como si el hijo no existiera: este
        // tablero hereda la misma falta de dato que su hijo, con el
        // motivo puntual de cuál hijo es.
        const rHijo = agregados[hijoIncompleto.id];
        agregados[t.id] = {
          ok: false,
          pendiente: !!rHijo.pendiente,
          motivo: `Tablero hijo "${hijoIncompleto.nombre}" ${
            rHijo.pendiente ? "todavía no tiene su alimentador calculado" : "no cumple su propio límite de tramo"
          }: ${rHijo.motivo || rHijo.error}`,
        };
        continue;
      }

      const circuitosPropios = circuitosDeTablero(t.id, listaCircuitos);
      const resultadosPropios = circuitosPropios
        .map((c) => listaResultados.find((r) => r.id === c.id))
        .filter(Boolean);

      // Demanda de cada hijo, YA agregada de su propio subárbol,
      // disfrazada de "resultado de circuito" para reusar
      // combinarResultadosCircuitos sin tocarlo.
      const pseudoResultadosHijos = hijos.map((h) => ({
        ok: true,
        cargaDemandaNormativaW: agregados[h.id].potenciaTotalW,
        cosPhiEfectivo: agregados[h.id].cosPhiCombinado,
      }));

      agregados[t.id] = calcularAlimentador(
        t,
        [...resultadosPropios, ...pseudoResultadosHijos],
        t.fases,
        normativa
      );
    }

    return agregados[tableroId];
  },
};
