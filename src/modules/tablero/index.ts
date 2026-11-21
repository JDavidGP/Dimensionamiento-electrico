// src/modules/tablero/index.ts
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
import type { Tablero, DatosTablero, ConTableroId } from "./tipos.ts";

function normalizar(datos: DatosTablero = {}): Omit<Tablero, "id"> {
  return {
    nombre: datos.nombre?.trim() || "Tablero sin nombre",
    // Sistema de etiquetado (ver modules/etiquetado/index.js) — código
    // corto (ej. "TD1") y función, puramente descriptivos, distintos
    // de `notas` (memo libre de la fuente de energía) y del id interno.
    etiqueta: datos.etiqueta?.trim() || "",
    funcion: datos.funcion || "",
    tensionAlimentacion: Number(datos.tensionAlimentacion) || 0,
    fases: datos.fases || "mono",
    // Capacidad contratada (kW) — documental, informativa, pedido
    // explícito del usuario (al lado de la tensión): NO reemplaza ni
    // se cruza con el grado de electrificación REBT (básica 5750W /
    // elevada 9200W — ver SelectorGradoVivienda/simultaneidadREBT.js),
    // que es un concepto normativo distinto, ya conectado a un cálculo
    // real, y sigue viviendo donde estaba.
    capacidadKW: datos.capacidadKW === "" || datos.capacidadKW == null ? "" : Number(datos.capacidadKW) || 0,
    tableroPadreId: datos.tableroPadreId || null,
    longitudAlimentador: Number(datos.longitudAlimentador) || 0,
    materialAlimentador: datos.materialAlimentador?.toLowerCase() || "cobre",
    // A qué línea(s) del tablero PADRE está conectado este alimentador
    // — para balance de fases (agregación hacia el padre). [] = sin
    // asignar, no participa en el balance del padre todavía. Sin UI
    // propia esta sesión — ver modules/motor/balanceFases.js.
    lineasAlimentador: Array.isArray(datos.lineasAlimentador) ? datos.lineasAlimentador : [],
    // Esquema de conmutación entre fuentes de energía — DOCUMENTAL,
    // null = sin configurar (comportamiento actual, sin cambios). Este
    // módulo no valida su forma interna a propósito (ese es trabajo de
    // normalizarConmutacion en modules/origen/conmutacion.js, que vive
    // en otro dominio — este módulo no lo importa, solo pasa el campo
    // de largo) — mismo criterio de aislamiento entre módulos que ya
    // sigue tableroPadreId con resolverOrigen.
    conmutacion: datos.conmutacion && typeof datos.conmutacion === "object" ? datos.conmutacion : null,
    // Coeficiente de simultaneidad REBT ITC-BT-10 (España) — DOCUMENTAL
    // a nivel de forma, igual criterio que conmutacion: este módulo no
    // valida su contenido (eso es normalizarSimultaneidadREBT en
    // modules/motor/simultaneidadREBT.js, otro dominio — no se importa
    // acá, solo se pasa de largo). null = sin activar (comportamiento
    // actual sin cambios: el alimentador suma sus tableros hijos al
    // 100%, que es lo correcto para locales/garajes/servicios generales
    // y para cualquier tablero que NO sea un edificio de viviendas).
    simultaneidadREBT: datos.simultaneidadREBT && typeof datos.simultaneidadREBT === "object" ? datos.simultaneidadREBT : null,
    // Grado de electrificación de ESTE tablero cuando actúa como
    // "vivienda" bajo el simultaneidadREBT.activa de su padre y
    // todavía no tiene circuitos propios cargados (ITC-BT-10 §2.2: sin
    // conocer la demanda real, se usa el mínimo del grado). "" / valor
    // inválido = sin elegir, cae al gradoPorDefecto del padre.
    gradoElectrificacion: datos.gradoElectrificacion === "basica" || datos.gradoElectrificacion === "elevada" ? datos.gradoElectrificacion : null,
    // Memo libre — documental, pedido explícito del usuario, justo
    // después de la distancia de la fuente de energía en la UI.
    notas: datos.notas || "",
  };
}

export function crearTablero(datos: DatosTablero): Tablero {
  return { id: generarId(), ...normalizar(datos) };
}

/**
 * Devuelve el tablero con los cambios aplicados — NO muta el original
 * (mismo criterio que asignarCircuitoATablero; la escritura real la
 * aplica la capa de aplicación / hook, ver ARCHITECTURE.md §1.6).
 */
export function editarTablero(tablero: Tablero, cambios: DatosTablero): Tablero {
  return { ...tablero, ...normalizar({ ...tablero, ...cambios }) };
}

/** Circuitos que pertenecen a un tablero (lectura, calculada). */
export function circuitosDeTablero<C extends ConTableroId>(tableroId: string, circuitos: C[] = []): C[] {
  return circuitos.filter((c) => c.tableroId === tableroId);
}

/** Circuitos sin ningún tablero asignado todavía. */
export function circuitosSinTablero<C extends ConTableroId>(circuitos: C[] = []): C[] {
  return circuitos.filter((c) => !c.tableroId);
}

/**
 * Devuelve el circuito con tableroId actualizado — NO muta el original
 * (mutaciones reales las aplica la capa de aplicación / hook, ver
 * ARCHITECTURE.md §1.6). Pasar `null` desasigna.
 */
export function asignarCircuitoATablero<C extends ConTableroId>(circuito: C, tableroId: string | null): C {
  return { ...circuito, tableroId: tableroId ?? null };
}

/**
 * Devuelve el circuito con `lineas` actualizado — mismo criterio que
 * asignarCircuitoATablero (no muta; la escritura real la hace la capa
 * de aplicación / hook). Para balance de fases, ver
 * TableroMediator.balanceFasesDeTablero. NO valida acá que la cantidad
 * coincida con circuito.fases — esa restricción vive en la UI
 * (shared/utils/lineasFases.js), que ya constriñe la interacción para
 * que no pueda quedar mal armada desde ahí.
 */
export function asignarLineasACircuito<C extends object>(circuito: C, lineas: unknown): C & { lineas: unknown[] } {
  return { ...circuito, lineas: Array.isArray(lineas) ? lineas : [] };
}

/**
 * Al eliminar un tablero, los circuitos que le pertenecían quedan sin
 * asignar (no se borran, no quedan huérfanos apuntando a un ID muerto).
 */
export function liberarCircuitosDeTablero<C extends ConTableroId>(tableroId: string, circuitos: C[] = []): C[] {
  return circuitos.map((c) =>
    c.tableroId === tableroId ? { ...c, tableroId: null } : c
  );
}

export interface CadenaAscendente {
  cadena: Tablero[];
  ciclo: boolean;
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
 */
export function obtenerCadenaAscendente(tableroId: string | null | undefined, tableros: Tablero[] = []): CadenaAscendente {
  const cadena: Tablero[] = [];
  const visitados = new Set<string>();
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
export function hijosDeTablero(tableroId: string, tableros: Tablero[] = []): Tablero[] {
  return tableros.filter((t) => t.tableroPadreId === tableroId);
}

export interface ArbolDescendente {
  orden: Tablero[];
  ciclo: boolean;
  tableroCiclo?: Tablero;
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
 * @returns `orden`: tableros del subárbol (incluido el propio
 *   `tableroId`), en orden post-orden. Si `ciclo` es true, `orden`
 *   puede venir incompleto — el llamador no debe usarlo como si fuera
 *   válido.
 */
export function obtenerArbolDescendentePostOrden(tableroId: string, tableros: Tablero[] = []): ArbolDescendente {
  const orden: Tablero[] = [];
  const visitados = new Set<string>();

  function visitar(id: string): { ciclo: boolean; tableroCiclo?: Tablero } {
    if (visitados.has(id)) {
      return { ciclo: true, tableroCiclo: tableros.find((t) => t.id === id) };
    }
    const actual = tableros.find((t) => t.id === id);
    if (!actual) return { ciclo: false };
    visitados.add(id);

    for (const hijo of hijosDeTablero(id, tableros)) {
      const resultado = visitar(hijo.id!);
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

export type { Tablero, DatosTablero, ConTableroId } from "./tipos.ts";
