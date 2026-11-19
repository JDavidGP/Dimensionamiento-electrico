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
  DESCONOCIDO: "desconocido",
  // TRANSFORMADOR: "transformador", — sigue sin conectar, ver el
  // bloque PENDIENTE más abajo antes de descomentar esto.
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
 *     ya resuelta. CONECTADO (usuario, 2026-11-19): a diferencia de
 *     Transformador (ver PENDIENTE abajo), Batería y Generador sí se
 *     conectaron esta sesión — PanelTableros.jsx ya las ofrece en el
 *     selector de "Tablero padre".
 *   - Cualquier otro valor (id que no existe en ninguno de los dos
 *     catálogos) → DESCONOCIDO. NO se asume que es un futuro
 *     Transformador ni ninguna otra cosa — es una referencia rota, y
 *     se reporta como tal (ValidacionMediator ya tiene su propio
 *     chequeo de tableroPadreId inexistente, extendido para aceptar
 *     también fuentes válidas; este módulo no lo duplica, solo no
 *     miente sobre qué encontró).
 *
 * PENDIENTE — Transformador (documentado a propósito, NO conectar
 * todavía; no hay un proyecto real que lo necesite para validar el
 * diseño contra datos reales):
 *
 *   DECISIÓN DE PLANIFICACIÓN (no técnica, para ubicar el trabajo en
 *   el tiempo): Transformador se integra junto con el sistema de media
 *   tensión, cuando ese sistema se desarrolle — no antes, y no como
 *   pieza aislada. Única excepción: si aparece la necesidad real de
 *   darle identidad propia a un transformador en BAJA tensión (ej. un
 *   transformador de aislamiento o reductor 240V→120V dentro de una
 *   instalación de baja tensión, sin que medie todavía el sistema de
 *   media tensión completo) — en ese caso puntual sí se adelanta esta
 *   pieza, acotada a ese uso, sin esperar al desarrollo completo de
 *   media tensión.
 *
 *   ESA EXCEPCIÓN YA TIENE UN DISPARADOR CONCRETO (usuario,
 *   2026-11-20 — todavía sin implementar, solo registrado; "puede
 *   esperar" según sus propias palabras): Transformador entra al mismo
 *   selector de origen que Batería/Generador, pero SOLO cuando
 *   tipoInstalacion === "industrial" (ver shared/constants/
 *   constantes.js TIPOS_INSTALACION, ya conectado en
 *   SelectorNormativa.jsx). Tiene sentido con la propia investigación
 *   NEC/REBT sobre instalación industrial anotada en ese archivo: la
 *   escala/potencia que distingue a una instalación industrial es
 *   justamente donde aparecen transformadores reductores/de
 *   aislamiento propios con más frecuencia que en una domiciliaria.
 *   Cuando se implemente: PanelTableros.jsx necesita a `tipoInstalacion`
 *   como prop (hoy no la tiene) para condicionar el <optgroup> de
 *   Transformador en el selector de "Origen", igual patrón que ya usa
 *   para el <optgroup> de "Fuentes de energía".
 *
 *   Un Transformador es un tipo de origen conceptualmente distinto a
 *   Tablero Y a Batería/Generador: cambia el nivel de tensión
 *   (primario ≠ secundario), no tiene "alimentador" en el mismo
 *   sentido que un tablero (tiene devanados, %Z, relación de
 *   transformación, conexión Y/Δ). La entidad ya existe —
 *   `modules/motor/transformador.js` (TRANSFORMADOR_VACIO,
 *   normalizarTransformador, calcularCorrientesNominales), creada sin
 *   conectar a pedido explícito del usuario.
 *
 *   Para conectarla (el mecanismo de "segundo catálogo" ya existe,
 *   fuentesEnergia demuestra que funciona — falta sumar un tercero):
 *     1. Sumar `transformadores` como tercer catálogo a resolverOrigen
 *        además de `tableros` y `fuentesEnergia`.
 *     2. Que quien consuma `resolverOrigen` sepa tratar el caso
 *        TRANSFORMADOR distinto de TABLERO/BATERIA/GENERADOR: un
 *        transformador cambia la tensión de referencia del tramo
 *        siguiente, los demás no.
 *     3. Que evaluarCaidaAcumulada (modules/motor/caidaTensionAcumulada.js)
 *        deje de asumir una sola tensión de referencia para toda la
 *        cadena — ver la nota de alcance en ese archivo, es el mismo
 *        pendiente visto desde el otro lado.
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
 * @returns {
 *   { tipo: "acometida" } |
 *   { tipo: "tablero", tablero: object } |
 *   { tipo: "bateria"|"generador", fuente: object } |
 *   { tipo: "desconocido", origenId: string }
 * }
 */
export function resolverOrigen(origenId, tableros = [], fuentesEnergia = []) {
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
