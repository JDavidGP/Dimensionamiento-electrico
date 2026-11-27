import { MIN_COSPHI, MAX_COSPHI, MIN_TEMP_C, MAX_TEMP_C } from "../../shared/constants/constantes.ts";
import { generarId } from "../../shared/utils/id.ts";
import { TIPOS_EQUIPO_NEC as TIPOS_EQUIPO_NEC_CRUDO } from "../../shared/data/tiposEquipoNEC.ts";
const TIPOS_EQUIPO_NEC: Record<string, unknown> = TIPOS_EQUIPO_NEC_CRUDO;
import type { Circuito, Equipo } from "./tipos.ts";

// ---------------------------------------------------------------------------
// CIRCUITO
// ---------------------------------------------------------------------------

/** Estado crudo del formulario de circuito — todo texto (inputs de UI), antes de convertir. */
export interface FormularioCircuito {
  nombre: string;
  etiqueta?: string;
  funcion?: string;
  representacion?: string;
  tipo: string;
  fases: string;
  voltaje: string;
  voltajeManual?: boolean;
  material: string;
  distancia: string;
  temp: string;
  factorSimultaneidadManual?: string | number | null;
  tableroId?: string | null;
  diferencialId?: string | null;
  proteccionAFCI?: boolean;
  lineas?: unknown[];
}

export function validarCircuito(form: FormularioCircuito): string | null {
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
    const fs = parseFloat(String(form.factorSimultaneidadManual));
    if (!(fs >= 0 && fs <= 1)) return "El factor de simultaneidad debe estar entre 0 y 1.";
  }
  return null;
}

export function formularioACircuito(form: FormularioCircuito, idExistente: string | null = null): Circuito {
  const fsRaw = form.factorSimultaneidadManual;
  const factorSimultaneidadManual =
    fsRaw === "" || fsRaw == null || Number.isNaN(parseFloat(String(fsRaw)))
      ? null
      : parseFloat(String(fsRaw));

  return {
    id: idExistente ?? generarId(),
    nombre: form.nombre,
    // Sistema de etiquetado (ver modules/etiquetado/index.js) — código
    // corto y función, puramente descriptivos, no son el id interno.
    etiqueta: form.etiqueta || "",
    funcion: form.funcion || "",
    representacion: form.representacion || "ambos",
    tipo: form.tipo as Circuito["tipo"],
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
    // Pass-through, mismo criterio exacto que tableroId arriba — se
    // asigna vía DiferencialMediator (ver asignarCircuitoADiferencial en
    // useCircuitos.js), nunca desde este formulario. Bug encontrado y
    // corregido en esta misma ronda (2026-11-26): al faltar acá, CUALQUIER
    // edición del circuito (ej. solo cambiar el nombre) borraba en
    // silencio el diferencial ya asignado.
    diferencialId: form.diferencialId ?? null,
    proteccionAFCI: !!form.proteccionAFCI,
    // Pass-through, mismo criterio: todavía no hay UI para elegir línea
    // (balance de fases), no se debe perder al re-guardar.
    lineas: form.lineas ?? [],
  };
}

export function circuitoAFormulario(circuito: Circuito): FormularioCircuito {
  return {
    nombre: circuito.nombre ?? "",
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
    diferencialId: circuito.diferencialId ?? null,
    proteccionAFCI: !!circuito.proteccionAFCI,
    lineas: circuito.lineas ?? [],
  };
}

// ---------------------------------------------------------------------------
// EQUIPO
// ---------------------------------------------------------------------------

/** Estado crudo del formulario de equipo — todo texto (inputs de UI), antes de convertir. */
export interface FormularioEquipo {
  nombre: string;
  etiqueta?: string;
  funcion?: string;
  cantidad: string | number;
  modoEntrada: "corriente" | "potencia";
  valor: string | number;
  cosPhi: string | number;
  tipoEquipoNEC?: string;
  esCargaContinua?: boolean;
  corrienteRotorBloqueado?: string | number | null;
  alturaInstalacionM?: string | number | null;
  referenciaAltura?: "techo" | "piso";
  proteccionGFCI?: boolean;
}

export function validarEquipo(form: FormularioEquipo): string | null {
  const cantidad = parseInt(String(form.cantidad), 10);
  const valor = parseFloat(String(form.valor));
  const cosPhi = parseFloat(String(form.cosPhi));

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
  // Altura de instalación: opcional (vacío = no cargada), pero si se
  // escribe algo tiene que ser un número real ≥ 0 — no se guarda un
  // dato basura que después arruine en silencio el cálculo del Plano.
  if (form.alturaInstalacionM !== "" && form.alturaInstalacionM != null) {
    const alturaInstalacionM = parseFloat(String(form.alturaInstalacionM));
    if (!(alturaInstalacionM >= 0)) return "La altura de instalación no puede ser negativa.";
  }
  return null;
}

export function formularioAEquipo(form: FormularioEquipo, circuitoId: string | null, idExistente: string | null = null): Equipo {
  const lra =
    form.corrienteRotorBloqueado === "" || form.corrienteRotorBloqueado == null
      ? null
      : parseFloat(String(form.corrienteRotorBloqueado));
  const alturaInstalacionM =
    form.alturaInstalacionM === "" || form.alturaInstalacionM == null ? null : parseFloat(String(form.alturaInstalacionM));

  return {
    id: idExistente ?? generarId(),
    circuitoId,
    nombre: form.nombre,
    etiqueta: form.etiqueta || "",
    funcion: form.funcion || "",
    cantidad: parseInt(String(form.cantidad), 10),
    modoEntrada: form.modoEntrada,
    valor: parseFloat(String(form.valor)),
    cosPhi: parseFloat(String(form.cosPhi)),
    tipoEquipoNEC: form.tipoEquipoNEC || "CARGA_GENERAL",
    esCargaContinua: !!form.esCargaContinua,
    corrienteRotorBloqueado:
      form.tipoEquipoNEC === "MOTOR" && lra != null && lra > 0 ? lra : null,
    alturaInstalacionM: alturaInstalacionM != null && alturaInstalacionM >= 0 ? alturaInstalacionM : null,
    referenciaAltura: form.referenciaAltura === "piso" ? "piso" : "techo",
    proteccionGFCI: !!form.proteccionGFCI,
  };
}

export function equipoAFormulario(equipo: Equipo): FormularioEquipo {
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
    alturaInstalacionM: equipo.alturaInstalacionM == null ? "" : String(equipo.alturaInstalacionM),
    referenciaAltura: equipo.referenciaAltura === "piso" ? "piso" : "techo",
    proteccionGFCI: !!equipo.proteccionGFCI,
  };
}
