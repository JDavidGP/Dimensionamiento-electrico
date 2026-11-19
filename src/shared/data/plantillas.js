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
  // A qué línea(s) del tablero está conectado ("L1"/"L2"/"L3", según
  // cuántas tenga disponibles su tablero) — para balance de fases.
  // [] = sin asignar todavía, el circuito NO participa en el balance
  // (no se inventa una línea por defecto). Cantidad de líneas =
  // cantidad de líneas físicas de este circuito (1 para mono, 2 para
  // bi, 3 —todas— para tri) — no es libre, la valida balanceFases.
  // NO tiene UI propia todavía. Ver modules/motor/balanceFases.js.
  lineas: [],
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
  // A qué línea(s) del tablero PADRE está conectado el alimentador de
  // ESTE tablero (mismo concepto que circuito.lineas, un nivel más
  // arriba) — para que balance de fases pueda agregar la demanda de
  // subtableros hacia el padre por la línea correcta. [] = sin asignar
  // (no participa en el balance del padre todavía). No aplica cuando
  // tableroPadreId es null (alimentado de la acometida, no hay "líneas
  // del padre" que elegir todavía — ver módulo origen).
  lineasAlimentador: [],
  // Esquema de conmutación entre fuentes de energía — DOCUMENTAL, no
  // alimenta ningún cálculo (ver modules/origen/conmutacion.js). null
  // = sin configurar.
  conmutacion: null,
};
