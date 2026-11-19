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
// CERO gráfico, cero UI. Módulo puro — se usa entre sí o, si hiciera
// falta cruzar dominios más adelante, a través de un mediator propio
// (todavía no existe uno: hoy es tan chico que no lo necesita).

/**
 * Tipos de origen posibles. Declarados como constantes para que nadie
 * (yo incluido, en una sesión futura) invente un string distinto sin
 * querer — comparar contra estos valores, no contra literales sueltos.
 */
export const TIPOS_ORIGEN = {
  TABLERO: "tablero",
  ACOMETIDA: "acometida",
  DESCONOCIDO: "desconocido",
  // TRANSFORMADOR: "transformador", — ver el comentario largo en
  // resolverOrigen() más abajo antes de descomentar esto.
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
 *   - Cualquier otro valor (id que no existe en `tableros`) →
 *     DESCONOCIDO. NO se asume que es un futuro Transformador ni
 *     ninguna otra cosa — es una referencia rota, y se reporta como
 *     tal (ValidacionMediator ya tiene su propio chequeo de
 *     tableroPadreId inexistente; este módulo no lo duplica, solo no
 *     miente sobre qué encontró).
 *
 * DECISIÓN DE PLANIFICACIÓN (no técnica, para ubicar el trabajo en el
 * tiempo): Transformador se integra junto con el sistema de media
 * tensión, cuando ese sistema se desarrolle — no antes, y no como
 * pieza aislada. Única excepción: si aparece la necesidad real de darle
 * identidad propia a un transformador en BAJA tensión (ej. un
 * transformador de aislamiento o reductor 240V→120V dentro de una
 * instalación de baja tensión, sin que medie todavía el sistema de
 * media tensión completo) — en ese caso puntual sí se adelanta esta
 * pieza, acotada a ese uso, sin esperar al desarrollo completo de media
 * tensión.
 *
 * PENDIENTE — Transformador (documentado a propósito, NO conectar
 * todavía; no hay un proyecto real que lo necesite para validar el
 * diseño contra datos reales):
 *
 *   Un Transformador es un tipo de origen conceptualmente distinto a
 *   Tablero: cambia el nivel de tensión (primario ≠ secundario), no
 *   tiene "alimentador" en el mismo sentido que un tablero (tiene
 *   devanados, %Z, relación de transformación, conexión Y/Δ), y por
 *   eso NO debería modelarse reutilizando la entidad Tablero con
 *   campos opcionales.
 *
 *   La entidad ya existe — `modules/motor/transformador.js`
 *   (TRANSFORMADOR_VACIO, normalizarTransformador,
 *   calcularCorrientesNominales), creada sin conectar a pedido
 *   explícito del usuario. Vive en modules/motor/ (junto a
 *   canalizacion.js y cortocircuito.js), no en un modules/transformador/
 *   propio como se planteaba antes acá — ajustar esta referencia si
 *   cambia de ubicación más adelante.
 *
 *   Para conectarla, esta función necesita:
 *     1. Un segundo catálogo como parámetro (`transformadores`, junto
 *        a `tableros`) y buscar `origenId` en AMBOS — hoy alcanza con
 *        uno solo porque solo existe Tablero.
 *     2. Que los IDs de tablero y de transformador no puedan
 *        colisionar entre sí (ya lo garantiza generarId(), que es un
 *        UUID — no hace falta un prefijo por tipo, alcanza con
 *        buscarlo en las dos listas).
 *     3. Que quien consuma `resolverOrigen` (hoy nadie todavía — este
 *        módulo no está conectado ni a TableroMediator ni a la UI en
 *        esta sesión) sepa tratar el caso TABLERO y el caso
 *        TRANSFORMADOR distinto: un transformador cambia la tensión de
 *        referencia del tramo siguiente, un tablero no.
 *     4. Que evaluarCaidaAcumulada (modules/motor/caidaTensionAcumulada.js)
 *        deje de asumir una sola tensión de referencia para toda la
 *        cadena — ver la nota de alcance en ese archivo, es el mismo
 *        pendiente visto desde el otro lado.
 *
 * DECISIÓN DE UI (usuario, 2026-11-19): cuando esto se conecte, el
 * selector de "Tablero padre" que ya existe en el formulario de tablero
 * (PanelTableros.jsx) es el lugar elegido para elegir el origen — se
 * amplía esa misma lista desplegable para que, además de otros
 * tableros, aparezcan las fuentes de energía disponibles (Transformador,
 * y las de la nota siguiente). No se crea un selector nuevo aparte.
 *
 * NOTAS PARA MÁS ADELANTE (usuario, 2026-11-19 — todavía sin
 * desarrollar, quedan registradas para no perderlas; no implementar
 * sin que haya un proyecto real que lo necesite, mismo criterio que el
 * resto de este archivo):
 *
 *   - Más tipos de fuente además de Transformador: Generador y Banco de
 *     baterías — mismo grupo de "equipos especiales" opcional que ya
 *     se armó en shared/data/equiposEspeciales.js.
 *   - Fuentes configurables EN PARALELO o POR TURNOS: varios países
 *     alternan red pública de día y autoconsumo (solar/batería) de
 *     noche, o al revés — esto es un concepto de CONMUTACIÓN/HORARIO
 *     entre fuentes, distinto de "de dónde cuelga un tablero" (que es
 *     una relación fija). Probablemente necesite su propia entidad
 *     (algo como un "esquema de conmutación" con una lista de fuentes
 *     + la condición de cambio entre ellas), no un campo más en
 *     Tablero ni en Transformador.
 *   - Tipo de instalación — domiciliaria o industrial: afecta qué
 *     configuraciones de motores de alto consumo y transformadores
 *     tiene sentido ofrecer (ver shared/data/equiposEspeciales.js,
 *     donde se anotó la misma idea del lado de "equipos especiales").
 *   - Objetivo explícito del usuario al pedir esto: mantener la
 *     aplicación "más limpia" — o sea, estos son candidatos a opciones
 *     AVANZADAS/opcionales, no a ensanchar el flujo principal
 *     (normativa → tablero → circuito → equipo) para todo el mundo.
 *
 * @param {string|null|undefined} origenId
 * @param {object[]} tableros
 * @returns {
 *   { tipo: "acometida" } |
 *   { tipo: "tablero", tablero: object } |
 *   { tipo: "desconocido", origenId: string }
 * }
 */
export function resolverOrigen(origenId, tableros = []) {
  if (origenId == null) {
    return { tipo: TIPOS_ORIGEN.ACOMETIDA };
  }

  const tablero = tableros.find((t) => t.id === origenId);
  if (tablero) {
    return { tipo: TIPOS_ORIGEN.TABLERO, tablero };
  }

  return { tipo: TIPOS_ORIGEN.DESCONOCIDO, origenId };
}
