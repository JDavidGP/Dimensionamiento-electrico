// src/modules/origen/index.js
//
// Módulo Origen — resuelve de dónde viene la alimentación de un
// tablero, como una capa de INTERPRETACIÓN sobre el campo
// `tableroPadreId` que ya existe. NO renombra el dato, NO lo toca —
// evaluado a propósito: renombrar tableroPadreId ahora tocaría código
// ya probado (crearTablero, editarTablero, obtenerCadenaAscendente,
// obtenerArbolDescendentePostOrden, TableroMediator, validación
// referencial, PanelTableros.jsx) sin que haga falta todavía. Una capa
// de resolución encima es más barata y no arriesga nada de eso.
//
// CERO gráfico, cero UI. Módulo puro — se usa a través de
// OrigenMediator (core/mediators/OrigenMediator.js).

/**
 * Tipos de origen posibles. Declarados como constantes para que nadie
 * (yo incluido, en una sesión futura) invente un string distinto sin
 * querer — comparar contra estos valores, no contra literales sueltos.
 * BATERIA/GENERADOR viven en fuentesEnergia.js (TIPOS_FUENTE_ENERGIA)
 * — resolverOrigen() devuelve ESE valor directo como `tipo` cuando el
 * origen es una fuente, no uno nuevo acá, para no duplicar el enum.
 */
export const TIPOS_ORIGEN = {
  TABLERO: "tablero",
  ACOMETIDA: "acometida",
  TRANSFORMADOR: "transformador",
  DESCONOCIDO: "desconocido",
};

/**
 * Resuelve qué es un `origenId` — hoy, el valor que trae
 * `tablero.tableroPadreId` — sin asumir ni inventar nada:
 *
 *   - `null` (o `undefined`) → ACOMETIDA. Es la condición de CORTE de
 *     la cadena, no una entidad con su propia identidad ni datos
 *     propios — no hay "acometida.algo" que consultar todavía.
 *   - Un id que matchea un tablero real en `tableros` → TABLERO, con
 *     el objeto tablero ya resuelto (evita que el llamador tenga que
 *     volver a buscarlo).
 *   - Un id que matchea una fuente de energía real en `fuentesEnergia`
 *     (Batería o Generador — ver modules/origen/fuentesEnergia.js) →
 *     el `tipo` de ESA fuente ("bateria" | "generador"), con la fuente
 *     ya resuelta.
 *   - Un id que matchea un transformador real en `transformadores`
 *     (ver modules/motor/transformador.js) → TRANSFORMADOR, con el
 *     transformador ya resuelto. CONECTADO (usuario, 2026-11-19) SOLO
 *     como origen seleccionable (registro — "nos hace falta datos para
 *     desarrollar ese apartado"), gateado en la UI a
 *     tipoInstalacion === TIPOS_INSTALACION.COMERCIAL_INDUSTRIAL
 *     (ver shared/constants/constantes.js, PanelTableros.jsx). Sigue
 *     PENDIENTE, a propósito, todo lo que requeriría datos reales de un
 *     proyecto industrial que todavía no hay: que evaluarCaidaAcumulada
 *     (modules/motor/caidaTensionAcumulada.js) deje de asumir una sola
 *     tensión de referencia para toda la cadena (un transformador
 *     cambia el nivel de tensión primario≠secundario, los demás
 *     orígenes no) y cualquier cálculo que dependa de eso (%Z,
 *     cortocircuito aguas abajo del transformador). Este módulo NO
 *     calcula nada — solo resuelve identidad, igual que con tableros y
 *     fuentesEnergia.
 *   - Cualquier otro valor (id que no existe en ningún catálogo) →
 *     DESCONOCIDO. Referencia rota, reportada como tal
 *     (ValidacionMediator ya tiene su propio chequeo de
 *     tableroPadreId inexistente, extendido para aceptar también
 *     fuentes y transformadores válidos; este módulo no lo duplica,
 *     solo no miente sobre qué encontró).
 *
 * NOTAS PARA MÁS ADELANTE (usuario, 2026-11-19 — algunas ya resueltas,
 * quedan registradas para no perderlas; no implementar lo pendiente
 * sin que haya un proyecto real que lo necesite):
 *
 *   - Fuentes configurables EN PARALELO o POR TURNOS: YA CONECTADO
 *     (usuario, mensaje posterior) — ver modules/origen/conmutacion.js
 *     (MODOS_CONMUTACION: falla_automatica/horario/manual,
 *     CONMUTACION_VACIA, normalizarConmutacion) y el bloque
 *     "Conmutación entre fuentes" en PanelTableros.jsx. Vive en
 *     `tablero.conmutacion` (campo opcional, DOCUMENTAL — no
 *     reemplaza tableroPadreId, que sigue siendo lo único que usan los
 *     cálculos). CERO cálculo todavía: no recalcula nada contra una
 *     fuente distinta según hora/estado — solo registra el esquema
 *     esperado (principal/secundaria/auxiliar + modo de cambio) para
 *     la memoria del proyecto.
 *   - Tipo de instalación — domiciliaria o industrial: YA CONECTADO
 *     (ver SelectorNormativa.jsx) pero todavía puramente informativo
 *     — no filtra equipos/tablas todavía (ver
 *     shared/constants/constantes.js para la investigación NEC/REBT
 *     sobre qué distingue a una instalación industrial).
 *   - Objetivo explícito del usuario al pedir esto: mantener la
 *     aplicación "más limpia" — o sea, estos son candidatos a opciones
 *     AVANZADAS/opcionales, no a ensanchar el flujo principal
 *     (normativa → tablero → circuito → equipo) para todo el mundo.
 *
 * @param {string|null|undefined} origenId
 * @param {object[]} tableros
 * @param {object[]} [fuentesEnergia] — ver modules/origen/fuentesEnergia.js
 * @param {object[]} [transformadores] — ver modules/motor/transformador.js
 * @returns {
 *   { tipo: "acometida" } |
 *   { tipo: "tablero", tablero: object } |
 *   { tipo: "bateria"|"generador", fuente: object } |
 *   { tipo: "transformador", transformador: object } |
 *   { tipo: "desconocido", origenId: string }
 * }
 */
export function resolverOrigen(origenId, tableros = [], fuentesEnergia = [], transformadores = []) {
  if (origenId == null) {
    return { tipo: TIPOS_ORIGEN.ACOMETIDA };
  }

  const tablero = tableros.find((t) => t.id === origenId);
  if (tablero) {
    return { tipo: TIPOS_ORIGEN.TABLERO, tablero };
  }

  const fuente = fuentesEnergia.find((f) => f.id === origenId);
  if (fuente) {
    return { tipo: fuente.tipo, fuente };
  }

  const transformador = transformadores.find((tr) => tr.id === origenId);
  if (transformador) {
    return { tipo: TIPOS_ORIGEN.TRANSFORMADOR, transformador };
  }

  return { tipo: TIPOS_ORIGEN.DESCONOCIDO, origenId };
}

export {
  TIPOS_FUENTE_ENERGIA,
  ROLES_FUENTE_ENERGIA,
  FUENTE_ENERGIA_VACIA,
  crearFuenteEnergia,
  editarFuenteEnergia,
  liberarTablerosDeFuente,
} from "./fuentesEnergia.js";

export {
  MODOS_CONMUTACION,
  CONMUTACION_VACIA,
  normalizarConmutacion,
} from "./conmutacion.js";
