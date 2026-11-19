/**
 * validation/referencial.js
 * Fase 1 — Validación de integridad REFERENCIAL.
 *
 * Recorre Project → Circuit → Equipment (modelo plano real de la app)
 * y devuelve una lista PLANA de entradas para la UI.
 *
 * Modelo real:
 *   - proyecto: { id, nombre, ... }
 *   - circuitos: array plano (sin anidar equipos), con tableroId (FK opcional)
 *   - equipos: array plano con circuitoId (FK)
 *   - tableros: array plano (Fase 3) — dato relacional puro, cero gráfico
 *
 * No calcula nada eléctrico aquí — solo estructura y referencias.
 */

const ESTADOS = { OK: "ok", ADVERTENCIA: "advertencia", ERROR: "error" };

function peorEstado(a, b) {
  const rango = { ok: 0, advertencia: 1, error: 2 };
  return rango[b] > rango[a] ? b : a;
}

function crearEntrada({ id, tipo, nombre, parentId, estado, resumen, problemas }) {
  return {
    id,
    tipo, // "tablero" | "circuito" | "equipo"
    nombre,
    parentId,
    estado, // "ok" | "advertencia" | "error"
    resumen,
    problemas, // string[]
  };
}

function resumenCargaEquipo(equipo) {
  if (equipo.modoEntrada === "corriente" && equipo.valor != null) {
    return `${equipo.valor} A × ${equipo.cantidad ?? 1}`;
  }
  if (equipo.valor != null) {
    return `${equipo.valor} W × ${equipo.cantidad ?? 1}`;
  }
  return "sin datos de carga";
}

function validarEquipo(equipo, circuito, idsVistos) {
  const problemas = [];
  let estado = ESTADOS.OK;

  if (idsVistos.has(equipo.id)) {
    problemas.push("ID duplicado en el proyecto");
    estado = ESTADOS.ERROR;
  }
  idsVistos.add(equipo.id);

  if (!equipo.circuitoId) {
    problemas.push("Sin circuitoId (equipo huérfano)");
    estado = ESTADOS.ERROR;
  } else if (circuito && equipo.circuitoId !== circuito.id) {
    problemas.push(
      `Referencia cruzada: apunta a circuito ${equipo.circuitoId}, pero se validó bajo ${circuito.id}`
    );
    estado = ESTADOS.ERROR;
  }

  if (equipo.valor == null || !(Number(equipo.valor) > 0)) {
    problemas.push(
      equipo.modoEntrada === "corriente"
        ? "Sin corriente unitaria válida"
        : "Sin potencia unitaria válida"
    );
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  }

  if (!equipo.nombre || !String(equipo.nombre).trim()) {
    problemas.push("Nombre vacío");
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  }

  if (!(equipo.cantidad >= 1)) {
    problemas.push("Cantidad inválida (< 1)");
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  }

  return crearEntrada({
    id: equipo.id,
    tipo: "equipo",
    nombre: equipo.nombre || equipo.id,
    parentId: equipo.circuitoId || null,
    estado,
    resumen: resumenCargaEquipo(equipo),
    problemas,
  });
}

function validarCircuito(circuito, equiposDelCircuito, proyecto, idsVistos, tableros = []) {
  const problemas = [];
  let estado = ESTADOS.OK;

  if (idsVistos.has(circuito.id)) {
    problemas.push("ID duplicado en el proyecto");
    estado = ESTADOS.ERROR;
  }
  idsVistos.add(circuito.id);

  // tableroId es opcional (Fase 3 recién agregada) — un circuito sin
  // tablero asignado NO es un error, solo no está agrupado todavía.
  if (circuito.tableroId) {
    const tableroExiste = tableros.some((t) => t.id === circuito.tableroId);
    if (!tableroExiste) {
      problemas.push(`Referencia a tablero inexistente (${circuito.tableroId})`);
      estado = ESTADOS.ERROR;
    }
  }

  if (equiposDelCircuito.length === 0) {
    problemas.push("Sin equipos asignados");
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  }

  if (circuito.tipo === "dedicado" && equiposDelCircuito.length > 1) {
    problemas.push(
      "Marcado como dedicado pero tiene más de un equipo (recomendación: cambiar a mixto o separar)"
    );
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  }

  if (!circuito.nombre || !String(circuito.nombre).trim()) {
    problemas.push("Nombre vacío");
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  }

  if (!(Number(circuito.voltaje) > 0)) {
    problemas.push("Voltaje no definido o inválido");
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  }

  if (!circuito.fases) {
    problemas.push("Fases no asignadas");
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  }

  const entradaCircuito = crearEntrada({
    id: circuito.id,
    tipo: "circuito",
    nombre: circuito.nombre || circuito.id,
    parentId: circuito.tableroId || proyecto.id,
    estado,
    resumen: `${equiposDelCircuito.length} equipo(s)`,
    problemas,
  });

  const entradasEquipos = equiposDelCircuito.map((eq) =>
    validarEquipo(eq, circuito, idsVistos)
  );

  // El estado del circuito hereda el peor de sus equipos
  entradasEquipos.forEach((e) => {
    entradaCircuito.estado = peorEstado(entradaCircuito.estado, e.estado);
  });

  return [entradaCircuito, ...entradasEquipos];
}

function validarTablero(tablero, circuitos, idsVistos, proyectoId, tableros = [], fuentesEnergia = []) {
  const problemas = [];
  let estado = ESTADOS.OK;

  if (idsVistos.has(tablero.id)) {
    problemas.push("ID duplicado en el proyecto");
    estado = ESTADOS.ERROR;
  }
  idsVistos.add(tablero.id);

  const circuitosAsociados = circuitos.filter((c) => c.tableroId === tablero.id);
  if (circuitosAsociados.length === 0) {
    problemas.push("Sin circuitos asociados");
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  }

  // tableroPadreId es opcional: null significa alimentado directo de la
  // acometida/poste, no de otro tablero — no es un error. Puede
  // apuntar a OTRO tablero o a una fuente de energía (Batería/
  // Generador, ver modules/origen/fuentesEnergia.js) — mismo campo,
  // dos catálogos posibles a buscar (ver OrigenMediator.resolver).
  // NO se valida la cadena hacia arriba (ciclos) todavía — es el
  // siguiente paso, no esta sesión.
  if (tablero.tableroPadreId) {
    if (tablero.tableroPadreId === tablero.id) {
      problemas.push("Tablero padre apunta a sí mismo");
      estado = ESTADOS.ERROR;
    } else if (
      !tableros.some((t) => t.id === tablero.tableroPadreId) &&
      !fuentesEnergia.some((f) => f.id === tablero.tableroPadreId)
    ) {
      problemas.push(`Referencia a tablero padre o fuente de energía inexistente (${tablero.tableroPadreId})`);
      estado = ESTADOS.ERROR;
    }
  }

  return crearEntrada({
    id: tablero.id,
    tipo: "tablero",
    nombre: tablero.nombre || tablero.id,
    parentId: proyectoId,
    estado,
    resumen: `${circuitosAsociados.length} circuito(s)`,
    problemas,
  });
}

/**
 * Punto de entrada de Fase 1 (+ Fase 3, Tablero).
 * @param {Object} proyecto - metadatos del proyecto ({ id, nombre, ... })
 * @param {Array}  circuitos - array plano de circuitos
 * @param {Array}  equipos   - array plano de equipos (con circuitoId)
 * @param {Array}  tableros  - array plano de tableros (con id, nombre...)
 * @param {Array}  fuentesEnergia - array plano de fuentes de energía (Batería/Generador)
 * @returns {Array} lista plana de entradas para la UI
 */
export function validarIntegridadReferencial(proyecto, circuitos = [], equipos = [], tableros = [], fuentesEnergia = []) {
  const idsVistos = new Set();
  const entradas = [];
  const proj = proyecto || { id: "proyecto" };
  // Compatibilidad: si alguien todavía anida tableros en proyecto.tableros
  // en vez de pasarlos explícitos, se siguen aceptando.
  const listaTableros = tableros.length > 0 ? tableros : proj.tableros || [];

  listaTableros.forEach((t) => {
    entradas.push(validarTablero(t, circuitos, idsVistos, proj.id, listaTableros, fuentesEnergia));
  });

  circuitos.forEach((c) => {
    const equiposDelCircuito = equipos.filter((e) => e.circuitoId === c.id);
    entradas.push(...validarCircuito(c, equiposDelCircuito, proj, idsVistos, listaTableros));
  });

  // Equipos huérfanos (circuitoId que no existe)
  const idsCircuitos = new Set(circuitos.map((c) => c.id));
  equipos.forEach((eq) => {
    if (eq.circuitoId && !idsCircuitos.has(eq.circuitoId)) {
      if (!idsVistos.has(eq.id)) {
        idsVistos.add(eq.id);
        entradas.push(
          crearEntrada({
            id: eq.id,
            tipo: "equipo",
            nombre: eq.nombre || eq.id,
            parentId: eq.circuitoId,
            estado: ESTADOS.ERROR,
            resumen: resumenCargaEquipo(eq),
            problemas: [`Apunta a circuito inexistente (${eq.circuitoId})`],
          })
        );
      }
    }
  });

  return entradas;
}

export { ESTADOS, peorEstado };
