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
  asignarLineasACircuito,
  liberarCircuitosDeTablero,
  obtenerCadenaAscendente,
  hijosDeTablero,
  obtenerArbolDescendentePostOrden,
} from "../../modules/tablero/index.js";
import {
  calcularAlimentador,
  evaluarCaidaAcumulada,
  balanceFases,
  calcularCargaSimultaneaViviendas,
  potenciaMinimaGrado,
  GRADOS_ELECTRIFICACION,
} from "../../modules/motor/index.js";
import { DataProvider } from "../services/DataProvider.js";
import { NormativaMediator } from "./NormativaMediator.js";
import { Logger } from "../services/Logger.js";
import { Config } from "../services/Config.js";

export const TableroMediator = {
  /** Grados de electrificación REBT ITC-BT-10 (§2.1), expuestos para la UI — mismo patrón que OrigenMediator.MODOS_CONMUTACION. */
  GRADOS_ELECTRIFICACION,

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

  /** Devuelve el circuito con sus líneas (L1/L2/L3) actualizadas; el hook decide cómo guardarlo. */
  asignarLineas(circuito, lineas) {
    return asignarLineasACircuito(circuito, lineas);
  },

  /** Al borrar un tablero, libera (no borra) los circuitos que le pertenecían. */
  liberarCircuitos(tableroId, circuitos) {
    return liberarCircuitosDeTablero(tableroId, circuitos ?? DataProvider.getCircuitos());
  },

  /**
   * Caída de tensión ACUMULADA de un circuito, recorriendo la cadena de
   * tableros hacia arriba (su propio tablero → tableroPadreId → el
   * padre del padre → ... hasta la acometida). Suma VOLTIOS (no
   * porcentajes — cada tramo puede tener su propia tensión nominal) y
   * calcula el % final UNA sola vez, contra circuito.voltaje (la
   * tensión del punto de utilización). Límite 5% CONFIRMADO con fuente
   * (NEC 210.19(A) Nota informativa N.° 4 + 215.2(A)(1) Nota informativa
   * N.° 2) — ver el comentario completo en
   * modules/motor/caidaTensionAcumulada.js y en
   * LIMITE_CAIDA_TENSION_ACUMULADA_PROVISIONAL_PCT.
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
      // AGREGADO, no solo circuitos directos: la corriente que pasa por
      // el alimentador de este tablero es la de TODO su subárbol (sus
      // propios circuitos + cualquier subpanel que cuelgue de él), no
      // solo la porción que le corresponde a este circuito en particular
      // — la caída de tensión del conductor depende de la corriente
      // real que lo atraviesa, no de a quién "le toca" cada amperio.
      const alim = this.calcularAlimentadorAgregado(tablero.id, { tableros: listaTableros, circuitos, resultados, normativaId });

      if (!alim.ok) {
        if (alim.ciclo) {
          // Ciclo en el SUBÁRBOL de este tablero (padre→hijos) — distinto
          // del ciclo hijo→padre que ya se descartó arriba con
          // obtenerCadenaAscendente. Puede pasar en una rama hermana sin
          // afectar el camino ascendente en sí.
          return { aplica: true, ok: false, ciclo: true, error: alim.error };
        }
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
   *                                                    calcularAlimentador,
   *                                                    + `simultaneidadREBT`
   *                                                    (detalle n/coeficiente/
   *                                                    mediaW/cargaW) cuando
   *                                                    t.simultaneidadREBT.activa
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
      // Edificio de viviendas REBT ITC-BT-10 (usuario, 2026-11-19): este
      // tablero es la "gestión de la conexión del edificio" — sus hijos
      // DIRECTOS son las "viviendas" (cada una gestiona sus propios
      // circuitos igual que siempre, nada cambia ahí). Ver
      // modules/motor/simultaneidadREBT.js.
      const simultaneidadActiva = t.simultaneidadREBT?.activa === true;

      // Un hijo "sin circuitos todavía" bloquea normalmente — salvo que
      // el padre tenga activo el modo de viviendas, en cuyo caso
      // ITC-BT-10 §2.2 YA da un respaldo normativo para ese caso exacto
      // (demanda desconocida → grado de electrificación mínimo). Fuera
      // de ese caso puntual (alimentador sin longitud, un nieto
      // pendiente, un tramo que no cumple) sigue bloqueando igual que
      // antes — el respaldo de ITC-BT-10 no cubre datos rotos.
      const hijoIncompleto = hijos.find((h) => {
        const r = agregados[h.id];
        if (r?.ok) return false;
        if (simultaneidadActiva && r?.sinCircuitos) return false;
        return true;
      });

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

      let pseudoResultadosHijos;
      let cargaViviendas = null;

      if (simultaneidadActiva && hijos.length > 0) {
        // ITC-BT-10 §3.1: potencia prevista de cada vivienda = su
        // demanda YA calculada si ya tiene circuitos propios, o el
        // mínimo de su grado de electrificación (el suyo propio si lo
        // eligió, si no el gradoPorDefecto del padre) cuando todavía no
        // tiene ninguno — mismo criterio del ejemplo oficial de la
        // Guía-BT-10 ("ya que no se conoce la previsión exacta de
        // demanda eléctrica").
        const potenciasViviendas = hijos.map((h) => {
          const r = agregados[h.id];
          if (r?.ok) return r.potenciaTotalW;
          return potenciaMinimaGrado(h.gradoElectrificacion ?? t.simultaneidadREBT.gradoPorDefecto);
        });
        cargaViviendas = calcularCargaSimultaneaViviendas(potenciasViviendas);
        // cosPhiEfectivo=1: ITC-BT-10 da potencias PREVISTAS a prever,
        // no cargas reales con un factor de potencia propio — mismo
        // criterio que demanda100() en IEC_ES (modules/normativa/iec/es.js).
        pseudoResultadosHijos = cargaViviendas.ok
          ? [{ ok: true, cargaDemandaNormativaW: cargaViviendas.cargaW, cosPhiEfectivo: 1 }]
          : []; // n inválido no debería pasar nunca (hijos.length ya es >0) — si pasa, no se inventa una carga.
      } else {
        // Demanda de cada hijo, YA agregada de su propio subárbol,
        // disfrazada de "resultado de circuito" para reusar
        // combinarResultadosCircuitos sin tocarlo.
        pseudoResultadosHijos = hijos.map((h) => ({
          ok: true,
          cargaDemandaNormativaW: agregados[h.id].potenciaTotalW,
          cosPhiEfectivo: agregados[h.id].cosPhiCombinado,
        }));
      }

      const resultado = calcularAlimentador(t, [...resultadosPropios, ...pseudoResultadosHijos], t.fases, normativa);
      // Detalle del cálculo REBT adjunto para que la UI lo muestre sin
      // recalcularlo (mismo criterio que contribuyentesPorLinea en
      // balanceFasesDeTablero) — campo opcional, no cambia el contrato
      // existente para quien no usa este modo.
      agregados[t.id] = cargaViviendas ? { ...resultado, simultaneidadREBT: cargaViviendas } : resultado;
    }

    return agregados[tableroId];
  },

  /**
   * Balance de fases de UN tablero: % de desbalance de corriente entre
   * sus líneas (L1/L2/L3), agregando sus circuitos propios (según
   * circuito.lineas) + sus subtableros hijos DIRECTOS (según
   * hijo.lineasAlimentador, con la corriente YA agregada de todo el
   * subárbol de ese hijo vía calcularAlimentadorAgregado — NO hace
   * falta un recorrido recursivo propio para esto, ya lo resuelve esa
   * función; acá solo se reparte ese total entre las líneas del padre
   * que ese hijo declara usar).
   *
   * Por qué CORRIENTE, no potencia: un circuito/alimentador bifásico no
   * "reparte" su corriente entre sus dos líneas, la misma corriente
   * atraviesa ambas — ver la nota completa en modules/motor/balanceFases.js.
   *
   * Mismo criterio "nunca sumar 0 y seguir" que caidaAcumuladaDesdeCircuito:
   * si CUALQUIER circuito propio o hijo directo no tiene línea(s)
   * asignada(s) todavía, o no calcula OK, el resultado es
   * `noDeterminado`, no un % parcial que omite esa carga en silencio.
   *
   * Contrato de retorno:
   *   { aplica: false }                             — tablero mono (nada
   *                                                     que balancear),
   *                                                     o sin circuitos/hijos
   *   { aplica: true, ok: false, noDeterminado: true, motivo }
   *   { aplica: true, ok: true, porLinea, porcentajeDesbalance,
   *     limitePct, excede, contribuyentesPorLinea }
   *
   * `contribuyentesPorLinea`: { L1: [{tipo:"circuito"|"subtablero", id,
   * nombre, corrienteA}], ... } — mismos totales que `porLinea`,
   * desglosados por quién aporta cuánto. Lo usa PanelTableros.jsx para
   * sugerir qué mover cuando `excede` es true, sin tener que repetir
   * este recorrido en la UI.
   *
   * UMBRAL: 10% recomendado (CONFIRMADO, ver UMBRAL_DESBALANCE_FASES_PCT
   * en shared/constants/constantes.js), MODIFICABLE vía
   * Config.limites.desbalanceFasesPct o pasando `umbralPct` explícito
   * acá (Ajustes, en la UI) — si el umbral efectivo supera el
   * recomendado, el resultado trae una advertencia seria (ver
   * modules/motor/balanceFases.js), no lo permite en silencio.
   * CONECTADO a la UI (PanelTableros.jsx + TablaResultados.jsx, líneas
   * y balance visibles). FUERA DE ALCANCE todavía: subtablero con
   * alimentación mixta 120V/240V simultánea.
   */
  balanceFasesDeTablero(tableroId, { tableros, circuitos, resultados, normativaId, umbralPct } = {}) {
    const listaTableros = tableros ?? DataProvider.getTableros();
    const tablero = listaTableros.find((t) => t.id === tableroId);
    if (!tablero) {
      return { aplica: false };
    }
    if (tablero.fases === "mono") {
      return { aplica: false }; // una sola línea -- no hay nada que balancear
    }

    const listaCircuitos = circuitos ?? DataProvider.getCircuitos();
    const listaResultados = resultados ?? DataProvider.getResultados();
    const circuitosPropios = circuitosDeTablero(tableroId, listaCircuitos);
    const hijos = hijosDeTablero(tableroId, listaTableros);

    if (circuitosPropios.length === 0 && hijos.length === 0) {
      return { aplica: false }; // nada que balancear todavía
    }

    const aportes = {};
    // Quién aporta cuánto a cada línea — mismos totales que `aportes`,
    // desglosados por origen. No alimenta el cálculo (eso es `aportes`
    // solo); existe para que la UI pueda sugerir qué mover sin tener
    // que recorrer todo esto de nuevo por su cuenta.
    const contribuyentesPorLinea = {};
    function registrarContribuyente(linea, item) {
      (contribuyentesPorLinea[linea] ??= []).push(item);
    }

    for (const c of circuitosPropios) {
      if (!c.lineas || c.lineas.length === 0) {
        return {
          aplica: true,
          ok: false,
          noDeterminado: true,
          motivo: `Circuito "${c.nombre}" todavía no tiene línea(s) asignada(s).`,
        };
      }
      const r = listaResultados.find((res) => res.id === c.id);
      if (!r?.ok) {
        return {
          aplica: true,
          ok: false,
          noDeterminado: true,
          motivo: `Circuito "${c.nombre}" todavía no calcula OK.`,
        };
      }
      for (const linea of c.lineas) {
        aportes[linea] = (aportes[linea] ?? 0) + r.corrienteDiseno;
        registrarContribuyente(linea, { tipo: "circuito", id: c.id, nombre: c.nombre, corrienteA: r.corrienteDiseno });
      }
    }

    for (const hijo of hijos) {
      if (!hijo.lineasAlimentador || hijo.lineasAlimentador.length === 0) {
        return {
          aplica: true,
          ok: false,
          noDeterminado: true,
          motivo: `Subtablero "${hijo.nombre}" todavía no tiene línea(s) de alimentador asignada(s).`,
        };
      }
      const alimHijo = this.calcularAlimentadorAgregado(hijo.id, {
        tableros: listaTableros,
        circuitos: listaCircuitos,
        resultados: listaResultados,
        normativaId,
      });
      if (!alimHijo.ok) {
        return {
          aplica: true,
          ok: false,
          noDeterminado: true,
          motivo: `Subtablero "${hijo.nombre}": ${alimHijo.motivo || alimHijo.error}`,
        };
      }
      for (const linea of hijo.lineasAlimentador) {
        aportes[linea] = (aportes[linea] ?? 0) + alimHijo.corrienteDiseno;
        registrarContribuyente(linea, { tipo: "subtablero", id: hijo.id, nombre: hijo.nombre, corrienteA: alimHijo.corrienteDiseno });
      }
    }

    const resultado = balanceFases(aportes, umbralPct ?? Config.limites.desbalanceFasesPct);
    if (!resultado.aplica) {
      return { aplica: false };
    }

    return { aplica: true, ok: true, ...resultado, contribuyentesPorLinea };
  },
};
