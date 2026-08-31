/**
 * validation/electrica.js
 * Fase 2 — Validación de integridad ELÉCTRICA.
 *
 * Se dispara al seleccionar una entrada de la lista de Fase 1.
 * Solo calcula la rama del nodo seleccionado.
 *
 * Modelo real de la app:
 *   - circuito.voltaje, circuito.fases ("mono"|"bi"|"tri")
 *   - equipo.valor + modoEntrada ("potencia"|"corriente"), cantidad, cosPhi
 *   - breaker y calibre NO se guardan en el circuito: se obtienen del
 *     resultado de calcularCircuito() si se pasa el mapa de resultados
 *   - normativaEngine: objeto NORMATIVAS[id] o wrapper con verificarCircuito
 */

const ESTADOS = { OK: "ok", ADVERTENCIA: "advertencia", ERROR: "error" };

function peorEstado(a, b) {
  const rango = { ok: 0, advertencia: 1, error: 2 };
  return rango[b] > rango[a] ? b : a;
}

/**
 * Localiza nodo por id dentro del estado plano.
 * @returns {{ tipo, data, circuitoPadre? } | null}
 */
function localizarNodo(id, proyecto, circuitos = [], equipos = []) {
  const tablero = (proyecto?.tableros || []).find((t) => t.id === id);
  if (tablero) return { tipo: "tablero", data: tablero };

  const circuito = circuitos.find((c) => c.id === id);
  if (circuito) return { tipo: "circuito", data: circuito };

  const equipo = equipos.find((e) => e.id === id);
  if (equipo) {
    const circuitoPadre = circuitos.find((c) => c.id === equipo.circuitoId) || null;
    return { tipo: "equipo", data: equipo, circuitoPadre };
  }

  return null;
}

/**
 * Estimación rápida de corriente del circuito (sin factor de demanda ni
 * cosφ completo). Útil como fallback cuando no hay resultado de cálculo.
 * Preferir siempre el resultado de calcularCircuito cuando esté disponible.
 */
function estimarCorrienteSimple(circuito, equiposDelCircuito) {
  let cargaTotalW = 0;
  for (const eq of equiposDelCircuito) {
    const cant = eq.cantidad ?? 1;
    if (eq.modoEntrada === "corriente" && eq.valor != null) {
      // Aproximación: I * V * cosφ * cant  (cosφ default 1)
      const cos = eq.cosPhi != null ? Number(eq.cosPhi) : 1;
      cargaTotalW += Number(eq.valor) * Number(circuito.voltaje || 120) * cos * cant;
    } else if (eq.valor != null) {
      cargaTotalW += Number(eq.valor) * cant;
    }
  }

  const tension = Number(circuito.voltaje) || 120;
  const fases = (circuito.fases || "mono").toLowerCase();
  // mono/bi → factor 1; tri → √3
  const factorFase = fases === "tri" || fases === "trifasico" ? Math.sqrt(3) : 1;
  const corriente = cargaTotalW / (tension * factorFase || 1);
  return { cargaTotalW, corriente };
}

function validarEquipoElectrico(equipo) {
  const mensajes = [];
  let estado = ESTADOS.OK;

  if (equipo.valor == null || !(Number(equipo.valor) > 0)) {
    mensajes.push(
      equipo.modoEntrada === "corriente"
        ? "Falta corriente unitaria para incluir en el cálculo de demanda"
        : "Falta potencia unitaria para incluir en el cálculo de demanda"
    );
    estado = ESTADOS.ADVERTENCIA;
  }

  if (equipo.tipoEquipoNEC === "MOTOR" && !equipo.corrienteRotorBloqueado) {
    mensajes.push(
      "Motor sin corriente de rotor bloqueado (LRA) — el arranque puede subestimarse"
    );
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  }

  return {
    id: equipo.id,
    tipo: "equipo",
    estado,
    datos: {
      valor: equipo.valor,
      modoEntrada: equipo.modoEntrada,
      cantidad: equipo.cantidad,
      cosPhi: equipo.cosPhi,
      tipoEquipoNEC: equipo.tipoEquipoNEC,
      esCargaContinua: !!equipo.esCargaContinua,
      corrienteRotorBloqueado: equipo.corrienteRotorBloqueado ?? null,
    },
    mensajes,
  };
}

/**
 * @param {Object} circuito
 * @param {Array}  equiposDelCircuito
 * @param {Object} [opts]
 * @param {Object} [opts.resultadoCalculo] - salida de calcularCircuito() para este circuito
 * @param {Object} [opts.normativaEngine]  - módulo NORMATIVAS[id] o wrapper
 */
function validarCircuitoElectrico(circuito, equiposDelCircuito, opts = {}) {
  const { resultadoCalculo, normativaEngine } = opts;
  const mensajes = [];
  let estado = ESTADOS.OK;

  let cargaTotalW;
  let corriente;

  if (resultadoCalculo && resultadoCalculo.ok) {
    cargaTotalW =
      resultadoCalculo.cargaDemandaNormativaW ??
      resultadoCalculo.potenciaTotal ??
      0;
    corriente =
      resultadoCalculo.corrienteDiseno ?? resultadoCalculo.corriente ?? 0;
  } else {
    const est = estimarCorrienteSimple(circuito, equiposDelCircuito);
    cargaTotalW = est.cargaTotalW;
    corriente = est.corriente;
    if (resultadoCalculo && !resultadoCalculo.ok) {
      mensajes.push(resultadoCalculo.error || "Cálculo de circuito falló");
      estado = ESTADOS.ADVERTENCIA;
    }
  }

  // Breaker: en la app se calcula, no se persiste. Si el resultado lo trae, validamos.
  const breaker =
    resultadoCalculo?.breaker ??
    resultadoCalculo?.breakerSeleccionado ??
    circuito.breaker ??
    null;

  if (breaker == null) {
    mensajes.push(
      "Breaker no disponible (aún no calculado o no asignado) — no se puede verificar capacidad de interrupción"
    );
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  } else if (Number(breaker) < corriente) {
    mensajes.push(
      `Breaker de ${breaker} A insuficiente para la corriente de diseño (${Number(corriente).toFixed(1)} A)`
    );
    estado = ESTADOS.ERROR;
  }

  if (!circuito.fases) {
    mensajes.push("Fases no asignadas — requerido para balance y factor √3");
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  }

  if (!(Number(circuito.voltaje) > 0)) {
    mensajes.push("Voltaje no definido");
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  }

  // Calibre: también suele venir del cálculo
  const calibre =
    resultadoCalculo?.seccion ??
    resultadoCalculo?.calibre ??
    circuito.calibre ??
    null;

  if (calibre == null) {
    mensajes.push("Calibre de conductor no disponible (aún no calculado)");
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  }

  // Gancho normativo opcional
  if (normativaEngine && typeof normativaEngine.verificarCircuito === "function") {
    const resultadoNormativa = normativaEngine.verificarCircuito(circuito, {
      corriente,
      breaker,
      calibre,
      equipos: equiposDelCircuito,
    });
    if (resultadoNormativa && !resultadoNormativa.ok) {
      mensajes.push(...(resultadoNormativa.mensajes || ["Falla de verificación normativa"]));
      estado = ESTADOS.ERROR;
    }
  }

  // Propagar advertencias del propio cálculo
  if (resultadoCalculo?.advertencias?.length) {
    mensajes.push(...resultadoCalculo.advertencias);
    if (estado === ESTADOS.OK) estado = ESTADOS.ADVERTENCIA;
  }

  return {
    id: circuito.id,
    tipo: "circuito",
    estado,
    datos: {
      cargaTotalW: Number(Number(cargaTotalW).toFixed(1)),
      corrienteCalculada: Number(Number(corriente).toFixed(2)),
      breaker: breaker != null ? Number(breaker) : null,
      calibre: calibre ?? null,
      fases: circuito.fases || null,
      voltaje: circuito.voltaje ?? null,
    },
    mensajes,
  };
}

function validarTableroElectrico(tablero, circuitos, equipos) {
  const circuitosAsociados = circuitos.filter((c) => c.tableroId === tablero.id);
  return {
    id: tablero.id,
    tipo: "tablero",
    estado: ESTADOS.ADVERTENCIA,
    datos: {
      circuitos: circuitosAsociados.map((c) => c.id),
      cantidadCircuitos: circuitosAsociados.length,
    },
    mensajes: [
      "Validación de tablero pendiente: caída de tensión y balance de fases (bloqueado hasta implementar entidad Tablero)",
    ],
  };
}

/**
 * Punto de entrada de Fase 2.
 *
 * @param {string} id
 * @param {Object} proyecto
 * @param {Array}  circuitos
 * @param {Array}  equipos
 * @param {Object} [opts]
 * @param {Object} [opts.resultadoCalculo] - resultado de calcularCircuito para el circuito (si aplica)
 * @param {Object} [opts.normativaEngine]
 * @returns {Object} reporte eléctrico del nodo
 */
export function validarIntegridadElectrica(
  id,
  proyecto,
  circuitos = [],
  equipos = [],
  opts = {}
) {
  const nodo = localizarNodo(id, proyecto, circuitos, equipos);
  if (!nodo) {
    return {
      id,
      estado: ESTADOS.ERROR,
      mensajes: ["Nodo no encontrado en el proyecto"],
    };
  }

  switch (nodo.tipo) {
    case "tablero":
      return validarTableroElectrico(nodo.data, circuitos, equipos);
    case "circuito": {
      const eqs = equipos.filter((e) => e.circuitoId === nodo.data.id);
      return validarCircuitoElectrico(nodo.data, eqs, opts);
    }
    case "equipo":
      return validarEquipoElectrico(nodo.data);
    default:
      return {
        id,
        estado: ESTADOS.ERROR,
        mensajes: ["Tipo de nodo desconocido"],
      };
  }
}

export { ESTADOS, localizarNodo };
