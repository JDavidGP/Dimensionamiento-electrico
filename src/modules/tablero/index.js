// src/modules/tablero/index.js
//
// Módulo Tablero — Fase 3 (dato relacional circuito↔tablero) + Fase 4
// (alimentador: longitud, material, fases, tableroPadreId). CERO
// gráfico. Solo se usa entre sí o a través de TableroMediator.
// No importa UI, motor, documentos ni diagramas.
//
// Diseño de la relación circuito↔tablero: el circuito guarda `tableroId`
// (FK, single source of truth). El tablero NO guarda una lista de
// circuitoIds — evita el mismo anti-patrón de doble escritura que
// ARCHITECTURE.md ya prohíbe para tabla↔diagrama. `circuitosDeTablero()`
// siempre se calcula filtrando, nunca se mantiene una segunda copia.
//
// tableroPadreId ya vive en el modelo (de dónde viene el alimentador).
// obtenerCadenaAscendente() es la primera pieza que lo encadena de
// verdad (caída de tensión acumulada, recorriendo tablero → padre →
// padre del padre...). Todavía NO hay jerarquía visual ni lista de
// subpaneles hacia abajo — eso sigue siendo el siguiente paso.

import { generarId } from "../../shared/utils/id.js";

function normalizar(datos = {}) {
  return {
    nombre: datos.nombre?.trim() || "Tablero sin nombre",
    tensionAlimentacion: Number(datos.tensionAlimentacion) || 0,
    fases: datos.fases || "mono",
    tableroPadreId: datos.tableroPadreId || null,
    longitudAlimentador: Number(datos.longitudAlimentador) || 0,
    materialAlimentador: datos.materialAlimentador?.toLowerCase() || "cobre",
    // A qué línea(s) del tablero PADRE está conectado este alimentador
    // — para balance de fases (agregación hacia el padre). [] = sin
    // asignar, no participa en el balance del padre todavía. Sin UI
    // propia esta sesión — ver modules/motor/balanceFases.js.
    lineasAlimentador: Array.isArray(datos.lineasAlimentador) ? datos.lineasAlimentador : [],
  };
}

export function crearTablero(datos) {
  return { id: generarId(), ...normalizar(datos) };
}

/**
 * Devuelve el tablero con los cambios aplicados — NO muta el original
 * (mismo criterio que asignarCircuitoATablero; la escritura real la
 * aplica la capa de aplicación / hook, ver ARCHITECTURE.md §1.6).
 */
export function editarTablero(tablero, cambios) {
  return { ...tablero, ...normalizar({ ...tablero, ...cambios }) };
}

/** Circuitos que pertenecen a un tablero (lectura, calculada). */
export function circuitosDeTablero(tableroId, circuitos = []) {
  return circuitos.filter((c) => c.tableroId === tableroId);
}

/** Circuitos sin ningún tablero asignado todavía. */
export function circuitosSinTablero(circuitos = []) {
  return circuitos.filter((c) => !c.tableroId);
}

/**
 * Devuelve el circuito con tableroId actualizado — NO muta el original
 * (mutaciones reales las aplica la capa de aplicación / hook, ver
 * ARCHITECTURE.md §1.6). Pasar `null` desasigna.
 */
export function asignarCircuitoATablero(circuito, tableroId) {
  return { ...circuito, tableroId: tableroId ?? null };
}

/**
 * Al eliminar un tablero, los circuitos que le pertenecían quedan sin
 * asignar (no se borran, no quedan huérfanos apuntando a un ID muerto).
 */
export function liberarCircuitosDeTablero(tableroId, circuitos = []) {
  return circuitos.map((c) =>
    c.tableroId === tableroId ? { ...c, tableroId: null } : c
  );
}

/**
 * Sube por tableroPadreId desde `tableroId` hasta la raíz (tablero sin
 * padre) o hasta detectar un ciclo. Devuelve la cadena en orden
 * ascendente — el propio tablero primero, después su padre, el padre
 * del padre, etc. NO incluye el circuito que originó la consulta, eso
 * lo agrega el llamador.
 *
 * Un tableroPadreId que vuelve a apuntar a un tablero YA visitado en
 * ESTA cadena es un ciclo: se corta ahí y se devuelve `ciclo: true` en
 * vez de colgar la función — nunca loop infinito. Un tableroPadreId
 * que apunta a un tablero inexistente simplemente termina la cadena
 * ahí (no es un ciclo, es una referencia rota — la reporta
 * ValidacionMediator aparte).
 *
 * @returns {{ cadena: object[], ciclo: boolean }}
 */
export function obtenerCadenaAscendente(tableroId, tableros = []) {
  const cadena = [];
  const visitados = new Set();
  let actualId = tableroId;

  while (actualId) {
    if (visitados.has(actualId)) {
      return { cadena, ciclo: true };
    }
    const actual = tableros.find((t) => t.id === actualId);
    if (!actual) break;
    visitados.add(actualId);
    cadena.push(actual);
    actualId = actual.tableroPadreId;
  }

  return { cadena, ciclo: false };
}

/** Subpaneles directos (hijos) de un tablero (lectura, calculada). */
export function hijosDeTablero(tableroId, tableros = []) {
  return tableros.filter((t) => t.tableroPadreId === tableroId);
}

/**
 * Recorre el árbol de tableros hacia ABAJO (padre → hijos) desde
 * `tableroId`, en orden POST-ORDEN: cada tablero aparece DESPUÉS de
 * todos sus descendientes. Es el orden correcto para agregar demanda
 * de abajo hacia arriba — un tablero necesita el resultado YA
 * calculado de todos sus hijos antes de poder calcular el suyo, y acá
 * puede haber varias ramas (abanico), no un solo camino.
 *
 * Dirección de recorrido DISTINTA a obtenerCadenaAscendente (que sube
 * por tableroPadreId, hijo → padre, un solo camino). Esta baja
 * filtrando quién tiene a cada tablero como padre, y puede ramificarse
 * — por eso necesita su PROPIA guarda de ciclos, no reusa la de
 * arriba. Un tablero que se volvería a visitar bajando por sus propios
 * descendientes es un ciclo en esta dirección: se corta ahí, nunca
 * recursión infinita.
 *
 * @returns {{ orden: object[], ciclo: boolean, tableroCiclo?: object }}
 *   `orden`: tableros del subárbol (incluido el propio `tableroId`),
 *   en orden post-orden. Si `ciclo` es true, `orden` puede venir
 *   incompleto — el llamador no debe usarlo como si fuera válido.
 */
export function obtenerArbolDescendentePostOrden(tableroId, tableros = []) {
  const orden = [];
  const visitados = new Set();

  function visitar(id) {
    if (visitados.has(id)) {
      return { ciclo: true, tableroCiclo: tableros.find((t) => t.id === id) };
    }
    const actual = tableros.find((t) => t.id === id);
    if (!actual) return { ciclo: false };
    visitados.add(id);

    for (const hijo of hijosDeTablero(id, tableros)) {
      const resultado = visitar(hijo.id);
      if (resultado.ciclo) return resultado;
    }

    orden.push(actual);
    return { ciclo: false };
  }

  const resultado = visitar(tableroId);
  return resultado.ciclo
    ? { orden, ciclo: true, tableroCiclo: resultado.tableroCiclo }
    : { orden, ciclo: false };
}
