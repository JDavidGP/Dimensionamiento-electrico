// src/modules/etiquetado/index.js
//
// "Sistema de etiquetado" — pedido explícito del usuario (2026-11-20):
// un código corto y visible (ej. "TD1", "TD1-C3", "TD1-C3-E1") más una
// descripción de "qué hace" cada objeto (tablero/circuito/equipo), y un
// punto único donde consultarlos todos juntos (ver PanelDirectorio.jsx).
//
// `etiqueta` y `funcion` NO son el id interno (`generarId()`, UUID,
// usado por todo el resto de la app para referencias/FKs) — son datos
// de presentación que el usuario ve y escribe, tal como un electricista
// rotularía un breaker o una caja en el terreno. El id interno sigue
// siendo la única fuente de verdad para relaciones; la etiqueta es
// puramente descriptiva, puede repetirse o quedar vacía sin romper nada.
//
// Autogenerado CON JERARQUÍA, pedido explícito del usuario — pero
// siempre como SUGERENCIA editable, nunca forzada: se calcula una vez,
// al abrir el formulario de un objeto NUEVO (ver useCircuitos.js), y
// después es un campo de texto común — el usuario la puede borrar o
// reescribir con su propia convención sin que nada se la vuelva a pisar.
//
// Módulo puro — cero React, cero UI. Se usa a través de
// EtiquetadoMediator (core/mediators/EtiquetadoMediator.js).

/**
 * Sugiere la próxima etiqueta de TABLERO libre, tipo "TD1", "TD2"... —
 * cuenta cuántos tableros YA tienen una etiqueta con ese prefijo y
 * ofrece la primera que no esté tomada (nunca reutiliza una etiqueta
 * existente, aunque el tablero que la tenía se haya borrado y "liberado"
 * el número — más simple y menos sorpresivo que reciclar huecos).
 */
export function sugerirEtiquetaTablero(tableros = [], prefijo = "TD") {
  return siguienteLibre(prefijo, tableros.map((t) => t.etiqueta));
}

/**
 * Sugiere la próxima etiqueta de CIRCUITO libre dentro de un tablero,
 * tipo "TD1-C3" — se basa en la etiqueta del tablero (o, si el tablero
 * todavía no tiene una, en "C{n}" a secas, sin prefijo de tablero).
 */
export function sugerirEtiquetaCircuito(tableroEtiqueta, circuitosDelTablero = []) {
  const prefijo = tableroEtiqueta ? `${tableroEtiqueta}-C` : "C";
  return siguienteLibre(prefijo, circuitosDelTablero.map((c) => c.etiqueta));
}

/**
 * Sugiere la próxima etiqueta de EQUIPO libre dentro de un circuito,
 * tipo "TD1-C3-E1" — mismo criterio, basada en la etiqueta del circuito.
 */
export function sugerirEtiquetaEquipo(circuitoEtiqueta, equiposDelCircuito = []) {
  const prefijo = circuitoEtiqueta ? `${circuitoEtiqueta}-E` : "E";
  return siguienteLibre(prefijo, equiposDelCircuito.map((e) => e.etiqueta));
}

/** Primer "prefijo{n}" (n arrancando en 1) que no esté ya en `existentes`. */
function siguienteLibre(prefijo, existentes = []) {
  const usadas = new Set(existentes.filter(Boolean));
  let n = 1;
  while (usadas.has(`${prefijo}${n}`)) n++;
  return `${prefijo}${n}`;
}

/**
 * Arma el listado consolidado para el "Directorio" — un objeto plano
 * por cada tablero/circuito/equipo del proyecto, con su etiqueta,
 * nombre, función y de qué depende (para dar contexto sin tener que
 * cruzar IDs a mano). Lectura pura: no muta nada, no calcula nada
 * eléctrico (eso es el Motor, fuera de alcance acá).
 *
 * @returns {{ id: string, tipoObjeto: "tablero"|"circuito"|"equipo", etiqueta: string, nombre: string, funcion: string, contexto: string }[]}
 */
export function listaDirectorio({ tableros = [], circuitos = [], equipos = [] } = {}) {
  const filas = [];

  for (const t of tableros) {
    filas.push({
      id: t.id,
      tipoObjeto: "tablero",
      etiqueta: t.etiqueta || "",
      nombre: t.nombre || "(sin nombre)",
      funcion: t.funcion || "",
      contexto: "",
    });
  }

  for (const c of circuitos) {
    const tablero = tableros.find((t) => t.id === c.tableroId);
    filas.push({
      id: c.id,
      tipoObjeto: "circuito",
      etiqueta: c.etiqueta || "",
      nombre: c.nombre || "(sin nombre)",
      funcion: c.funcion || "",
      contexto: tablero ? `en ${tablero.etiqueta || tablero.nombre}` : "sin tablero asignado",
    });
  }

  for (const e of equipos) {
    const circuito = circuitos.find((c) => c.id === e.circuitoId);
    filas.push({
      id: e.id,
      tipoObjeto: "equipo",
      etiqueta: e.etiqueta || "",
      nombre: e.nombre || "(sin nombre)",
      funcion: e.funcion || "",
      contexto: circuito ? `en ${circuito.etiqueta || circuito.nombre}` : "sin circuito",
    });
  }

  return filas;
}
