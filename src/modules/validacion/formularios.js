import { MIN_COSPHI, MAX_COSPHI, MIN_TEMP_C, MAX_TEMP_C } from "../../shared/constants/constantes.js";
import { generarId } from "../../shared/utils/id.js";
import { TIPOS_EQUIPO_NEC } from "../../shared/data/tiposEquipoNEC.js";

// ---------------------------------------------------------------------------
// CIRCUITO
// ---------------------------------------------------------------------------

export function validarCircuito(form) {
  const voltaje = parseFloat(form.voltaje);
  const distancia = parseFloat(form.distancia);
  const temp = parseFloat(form.temp);

  if (!form.nombre.trim()) return "El nombre del circuito es obligatorio.";
  if (!(voltaje > 0)) return "El voltaje debe ser mayor a 0 V.";
  if (!(distancia >= 0) || Number.isNaN(distancia)) return "La distancia no puede ser negativa.";
  if (!(temp >= MIN_TEMP_C && temp <= MAX_TEMP_C)) {
    return `La temperatura debe estar entre ${MIN_TEMP_C}°C y ${MAX_TEMP_C}°C.`;
  }
  if (form.factorSimultaneidadManual !== "" && form.factorSimultaneidadManual != null) {
    const fs = parseFloat(form.factorSimultaneidadManual);
    if (!(fs >= 0 && fs <= 1)) return "El factor de simultaneidad debe estar entre 0 y 1.";
  }
  return null;
}

export function formularioACircuito(form, idExistente = null) {
  const fsRaw = form.factorSimultaneidadManual;
  const factorSimultaneidadManual =
    fsRaw === "" || fsRaw == null || Number.isNaN(parseFloat(fsRaw))
      ? null
      : parseFloat(fsRaw);

  return {
    id: idExistente ?? generarId(),
    nombre: form.nombre,
    // Sistema de etiquetado (ver modules/etiquetado/index.js) — código
    // corto y función, puramente descriptivos, no son el id interno.
    etiqueta: form.etiqueta || "",
    funcion: form.funcion || "",
    representacion: form.representacion || "ambos",
    tipo: form.tipo,
    fases: form.fases,
    voltaje: parseFloat(form.voltaje),
    voltajeManual: form.voltajeManual ?? false,
    material: form.material,
    distancia: parseFloat(form.distancia),
    temp: parseFloat(form.temp),
    factorSimultaneidadManual,
    // Pass-through: todavía no hay campo de UI para esto (se asigna vía
    // TableroMediator), pero no se debe perder al re-guardar un circuito
    // existente que ya tenía tablero asignado.
    tableroId: form.tableroId ?? null,
    // Pass-through, mismo criterio: todavía no hay UI para elegir línea
    // (balance de fases), no se debe perder al re-guardar.
    lineas: form.lineas ?? [],
  };
}

export function circuitoAFormulario(circuito) {
  return {
    nombre: circuito.nombre,
    etiqueta: circuito.etiqueta || "",
    funcion: circuito.funcion || "",
    representacion: circuito.representacion || "ambos",
    tipo: circuito.tipo,
    fases: circuito.fases,
    voltaje: String(circuito.voltaje),
    voltajeManual: circuito.voltajeManual ?? false,
    material: circuito.material,
    distancia: String(circuito.distancia),
    temp: String(circuito.temp),
    factorSimultaneidadManual:
      circuito.factorSimultaneidadManual == null ? "" : String(circuito.factorSimultaneidadManual),
    tableroId: circuito.tableroId ?? null,
    lineas: circuito.lineas ?? [],
  };
}

// ---------------------------------------------------------------------------
// EQUIPO
// ---------------------------------------------------------------------------

export function validarEquipo(form) {
  const cantidad = parseInt(form.cantidad, 10);
  const valor = parseFloat(form.valor);
  const cosPhi = parseFloat(form.cosPhi);

  if (!form.nombre.trim()) return "El nombre del equipo es obligatorio.";
  if (!(cantidad >= 1)) return "La cantidad debe ser 1 o más.";
  if (!(valor > 0)) {
    return form.modoEntrada === "corriente"
      ? "La corriente unitaria debe ser mayor a 0 A."
      : "La potencia unitaria debe ser mayor a 0 W.";
  }
  if (!(cosPhi >= MIN_COSPHI && cosPhi <= MAX_COSPHI)) {
    return `El factor de potencia debe estar entre ${MIN_COSPHI} y ${MAX_COSPHI}.`;
  }
  if (!form.tipoEquipoNEC || !TIPOS_EQUIPO_NEC[form.tipoEquipoNEC]) {
    return "Selecciona un tipo de equipo (NEC).";
  }
  return null;
}

export function formularioAEquipo(form, circuitoId, idExistente = null) {
  const lra =
    form.corrienteRotorBloqueado === "" || form.corrienteRotorBloqueado == null
      ? null
      : parseFloat(form.corrienteRotorBloqueado);

  return {
    id: idExistente ?? generarId(),
    circuitoId,
    nombre: form.nombre,
    etiqueta: form.etiqueta || "",
    funcion: form.funcion || "",
    cantidad: parseInt(form.cantidad, 10),
    modoEntrada: form.modoEntrada,
    valor: parseFloat(form.valor),
    cosPhi: parseFloat(form.cosPhi),
    tipoEquipoNEC: form.tipoEquipoNEC || "CARGA_GENERAL",
    esCargaContinua: !!form.esCargaContinua,
    corrienteRotorBloqueado:
      form.tipoEquipoNEC === "MOTOR" && lra != null && lra > 0 ? lra : null,
  };
}

export function equipoAFormulario(equipo) {
  return {
    nombre: equipo.nombre,
    etiqueta: equipo.etiqueta || "",
    funcion: equipo.funcion || "",
    cantidad: String(equipo.cantidad),
    modoEntrada: equipo.modoEntrada,
    valor: String(equipo.valor),
    cosPhi: String(equipo.cosPhi),
    tipoEquipoNEC: equipo.tipoEquipoNEC || "CARGA_GENERAL",
    esCargaContinua: !!equipo.esCargaContinua,
    corrienteRotorBloqueado:
      equipo.corrienteRotorBloqueado == null ? "" : String(equipo.corrienteRotorBloqueado),
  };
}
