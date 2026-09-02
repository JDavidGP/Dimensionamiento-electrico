// Un CIRCUITO es lo que tiene un breaker físico: voltaje, fases,
// material, distancia — son propiedades del cableado, no de cada
// aparato conectado a él (por eso ya no viven en el equipo).
//
// La continuidad (1.25) ya NO vive aquí: se marca por equipo
// (esCargaContinua), según NEC 210.19 / 215.2.
export const CIRCUITO_VACIO = {
  nombre: "",
  tipo: "mixto", // "dedicado" | "mixto"
  fases: "mono", // "mono" | "bi" | "tri"
  voltaje: "120",
  voltajeManual: false,
  material: "cobre",
  distancia: "",
  temp: "30",
  // Solo informativo; NUNCA alimenta el dimensionamiento.
  // Visible en UI solo si tipo=mixto y hay >1 equipo.
  // A propósito SIN tabla por normativa (no es un campo pendiente,
  // es una decisión investigada) — ver el comentario completo en
  // modules/motor/factorDemanda.js.
  factorSimultaneidadManual: "", // "" | "0.0"–"1.0"
  // Dato relacional puro (Fase 3) — a qué tablero pertenece. null =
  // sin asignar todavía. NO tiene UI propia todavía; se gestiona vía
  // TableroMediator. Ver ARCHITECTURE.md.
  tableroId: null,
};

// Un EQUIPO es un aparato conectado a un circuito.
// tipoEquipoNEC activa la regla de demanda del Art. 220/430/etc.
export const EQUIPO_VACIO = {
  nombre: "",
  cantidad: "1",
  modoEntrada: "potencia", // "potencia" | "corriente"
  valor: "",
  cosPhi: "1.0",
  tipoEquipoNEC: "CARGA_GENERAL",
  esCargaContinua: false, // Art. 210.19 — 125 % antes de agrupar
  corrienteRotorBloqueado: "", // solo MOTOR; opcional
};

// Un TABLERO es dato relacional puro (Fase 3): agrupa circuitos bajo
// una misma alimentación. CERO gráfico — eso es Fase 6 (esquema
// unifilar), una entidad distinta que consumirá este dato más adelante.
export const TABLERO_VACIO = {
  nombre: "",
  tensionAlimentacion: "120",
  fases: "mono", // del ALIMENTADOR — puede ser tri aunque sus circuitos sean mono
  // Tramo troncal (alimentador) — Fase 4. tableroPadreId=null significa
  // que el origen es la acometida principal, no otro tablero (single
  // source of truth, mismo criterio anti-doble-escritura que tableroId
  // en circuito). Sección NO se ingresa a mano: la calcula el motor
  // (calcularAlimentador) a partir de la demanda agregada de sus
  // circuitos — igual que ya pasa con un circuito derivado.
  tableroPadreId: null,
  longitudAlimentador: "",
  materialAlimentador: "cobre",
};
