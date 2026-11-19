// src/modules/origen/conmutacion.js
//
// Esquema de conmutación entre fuentes de energía de UN tablero —
// pedido explícito del usuario, confirmando las 3 fuentes ya
// modeladas: red eléctrica local (Acometida), autoconsumo con batería
// y auxiliar del generador (ver fuentesEnergia.js para Batería/
// Generador como entidades, y la nota larga en index.js sobre este
// concepto).
//
// Vive en `tablero.conmutacion` (campo opcional, null = sin configurar
// — comportamiento actual sin cambios) — NO reemplaza tableroPadreId:
// ese sigue siendo la única fuente de verdad que usan los cálculos
// (caída acumulada, balance de fases, agregación de demanda). Este
// esquema es DOCUMENTAL/informativo — registra CÓMO se espera que la
// instalación alterne entre fuentes en el terreno, para que quede en
// la memoria del proyecto. CERO cálculo todavía: no cambia qué fuente
// "está activa ahora" en ningún resultado — eso es un paso futuro
// (requeriría que el motor supiera recalcular contra una fuente
// distinta según hora/estado, fuera de alcance de esta sesión).
//
// Módulo puro — se usa a través de OrigenMediator.

export const MODOS_CONMUTACION = {
  FALLA_AUTOMATICA: "falla_automatica", // ej. generador diesel que arranca solo ante un corte de red
  HORARIO: "horario", // ej. red de día, batería de noche (o al revés)
  MANUAL: "manual", // alguien mueve un interruptor/transferencia a mano
};

// "" en fuenteSecundariaId/fuenteAuxiliarId = no aplica (esquema de 1
// o 2 fuentes, no 3). fuentePrincipalId SIEMPRE tiene un valor — por
// defecto "acometida" (mismo sentinel que TIPOS_ORIGEN.ACOMETIDA, ver
// index.js), porque en la gran mayoría de instalaciones la red pública
// es la fuente de partida. Un id real (UUID) en cualquiera de los tres
// campos referencia una fuente de shared/data... modules/origen/
// fuentesEnergia.js (Batería/Generador).
export const CONMUTACION_VACIA = {
  activa: false,
  modo: MODOS_CONMUTACION.FALLA_AUTOMATICA,
  fuentePrincipalId: "acometida",
  fuenteSecundariaId: "",
  fuenteAuxiliarId: "",
  horarioPrincipalInicio: "",
  horarioPrincipalFin: "",
  notas: "",
};

/**
 * Normaliza un esquema de conmutación — mismo criterio que
 * normalizar() en modules/tablero/index.js: no inventa valores,
 * rellena defaults seguros ante datos faltantes o inválidos.
 */
export function normalizarConmutacion(datos = {}) {
  return {
    activa: !!datos.activa,
    modo: Object.values(MODOS_CONMUTACION).includes(datos.modo) ? datos.modo : MODOS_CONMUTACION.FALLA_AUTOMATICA,
    fuentePrincipalId: datos.fuentePrincipalId || "acometida",
    fuenteSecundariaId: datos.fuenteSecundariaId || "",
    fuenteAuxiliarId: datos.fuenteAuxiliarId || "",
    horarioPrincipalInicio: datos.horarioPrincipalInicio || "",
    horarioPrincipalFin: datos.horarioPrincipalFin || "",
    notas: datos.notas || "",
  };
}
