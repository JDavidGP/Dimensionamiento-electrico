// src/modules/plano/index.ts
//
// Dominio Plano — grafo de nodos/segmentos (paredes) en espacio MODELO
// (metros reales, ya calibrados — ver calibracion.js) + habitaciones
// derivadas. Mismo patrón de grafo de nodos y aristas que ya usa el
// diagrama unifilar (nodosDiagrama/conexionesDiagrama) — ver
// PLANO_INTELIGENTE_DISENO.md §7, no es un paradigma nuevo para esta
// app, es el mismo extendido a coordenadas reales.
//
// FASE 1 (2026-11-20, "construí la fase 1"): calibración + trazado
// MANUAL de paredes. Una "habitación" se registra cuando el usuario
// traza una cadena de paredes que VUELVE a su propio nodo de inicio
// (crearHabitacion/cerrarHabitacion más abajo) — mecanismo simple,
// sigue intacto, útil para el caso más común (un cuarto por vez).
// La detección automática de TODAS las caras de un grafo planar
// cualquiera (ej. una pared interior que separa dos cuartos, sin
// volver a trazar cada uno) se agregó después (usuario, 2026-11-25) —
// ver detectarCaras en deteccionCaras.ts, re-exportado más abajo.
// Aditivo, no reemplaza este mecanismo.
//
// CERO cálculo eléctrico, CERO React, CERO canvas/zoom — eso vive en
// PlanoCanvas.jsx (render) y en el hook (estado de sesión de trazado,
// como `origenPendiente` ya vive en DiagramaUnifilar.jsx, no acá).
//
// Módulo puro — se usa a través de PlanoMediator, igual criterio que
// modules/tablero/index.js con TableroMediator.

import { generarId } from "../../shared/utils/id.js";
import { distancia, areaPoligono, perimetroPoligono, longitudPolilinea, puntosRectangulo, puntoDentroDePoligono } from "../geometria/index.ts";
import type { Punto, NodoPlano, SegmentoPlano, TipoSegmento, HabitacionPlano, RutaConductorPlano, MarcadorEquipoPlano, EntidadVinculadaRuta } from "./tipos.ts";

export { calcularEscala, calcularEscalaPorPerimetro, imagenAModelo, modeloAImagen } from "./calibracion.ts";
// transformVistaInicial/aPantalla/aModelo/aplicarZoom/aplicarPan/
// ajustarAVentana/ZOOM_MIN/ZOOM_MAX se mudaron a modules/geometria/
// vistaZoomPan.js (usuario, 2026-11-20, al pedir lo mismo para el
// Diagrama unifilar) — es matemática de vista genérica, sin nada
// propio de Plano; PlanoMediator las importa directo de geometria/
// ahora, este módulo ya no las re-exporta.
export { pixelBordeMasFuerte, RADIO_BUSQUEDA_BORDE_PX, UMBRAL_MAGNITUD_BORDE } from "./deteccionBordes.ts";
export { detectarParedesCandidatas } from "./deteccionLineas.ts";
export { calcularHomografia, aplicarHomografia, invertirMatriz3x3 } from "./homografia.ts";
export { generarDXF, codificarDXFComoBytes } from "./exportarDXF.ts";
export { calcularCrucesPared, ANGULO_MINIMO_CRUCE_GRADOS } from "./cruceParedes.ts";
export { cajaDeHabitacion, calcularDeltaConEnganche } from "./enganchePuzzle.ts";
export { detectarCaras } from "./deteccionCaras.ts";
export { caminoMasCorto } from "./caminoRed.ts";
export { calcularExtraAlturaInstalacion, calcularLongitudEsperadaRuta } from "./alturaInstalacion.ts";
export { OPCIONES_TIPO_AMBIENTE } from "./tipoAmbiente.ts";
export type { TipoAmbiente } from "./tipoAmbiente.ts";
export { requiereProteccionGFCI } from "./proteccionGFCI.ts";
export type { RequerimientoGFCI } from "./proteccionGFCI.ts";
export { requiereProteccionAFCI } from "./proteccionAFCI.ts";
export type { RequerimientoAFCI } from "./proteccionAFCI.ts";
export {
  ANCHO_VOLUMEN_2_M,
  ANCHO_VOLUMEN_3_M,
  RADIO_VOLUMEN1_DEFECTO_M,
  SENSIBILIDAD_MAXIMA_VOLUMEN3_MA,
  ALTURA_LIMITE_VOLUMEN_BASE_M,
  ALTURA_LIMITE_VOLUMEN_TECHO_MAX_M,
  limiteAlturaM,
  clasificarDistanciaBano,
  fuenteAguaMasCercana,
  evaluarZonaBano,
} from "./volumenesBano.ts";
export type { ZonaBano, ResultadoZonaBano, MarcadorFuenteAgua } from "./volumenesBano.ts";

export type {
  Punto,
  NodoPlano,
  SegmentoPlano,
  TipoSegmento,
  HabitacionPlano,
  RutaConductorPlano,
  MarcadorEquipoPlano,
  EntidadVinculadaRuta,
  CalibracionPlano,
  CalibracionDosPuntos,
  CalibracionPorPerimetro,
  ResultadoCalibracion,
  LineaCandidata,
  OrientacionLinea,
  ResultadoDeteccionParedes,
  DatosExportarDXF,
} from "./tipos.ts";
export type { CrucePared, ResultadoCrucesPared } from "./cruceParedes.ts";
export type { CajaAABB } from "./enganchePuzzle.ts";
export type { CaraDetectada } from "./deteccionCaras.ts";
export type { CaminoEncontrado } from "./caminoRed.ts";

// Radio de "pegado" al trazar — un click a menos de 30cm (en el mundo
// real, no en píxeles de pantalla: así es independiente del zoom) de
// un nodo ya existente reusa ESE nodo en vez de crear uno superpuesto.
// Imprescindible para poder cerrar polígonos (dos paredes que
// comparten una esquina comparten el mismo nodo — FK, no copia, mismo
// criterio que circuito.tableroId en el resto de la app).
export const RADIO_SNAP_METROS = 0.3;

export function crearNodo(puntoModelo: Punto): NodoPlano {
  return { id: generarId(), punto: puntoModelo };
}

/** Nodo existente más cercano a `puntoModelo`, dentro de `radio` metros — o null si ninguno califica. Genérico: también sirve para buscar el equipo/marcador más cercano (cualquier cosa con `.punto`), ver "triangulación por recorrido" en PlanoInteligente.jsx. */
export function nodoCercano<N extends { punto: Punto }>(puntoModelo: Punto, nodos: N[] = [], radio: number = RADIO_SNAP_METROS): N | null {
  let masCercano: N | null = null;
  let menorDistancia = Infinity;
  for (const nodo of nodos) {
    const d = distancia(puntoModelo, nodo.punto);
    if (d <= radio && d < menorDistancia) {
      masCercano = nodo;
      menorDistancia = d;
    }
  }
  return masCercano;
}

export function crearSegmento(nodoAId: string, nodoBId: string, tipo: TipoSegmento = "pared"): SegmentoPlano {
  // espesorM: "" = no medido todavía — solo tiene sentido para tipo
  // "pared" (un conductor no tiene "espesor"). Se mide APARTE, después
  // de trazar la pared (usuario, 2026-11-20: "medir el ancho visible
  // de una pared en la foto, 2 clicks" — ver editarSegmento).
  return { id: generarId(), nodoAId, nodoBId, tipo, espesorM: "" };
}

/** Devuelve el segmento con los cambios aplicados — no muta el original (mismo criterio que editarTablero). */
export function editarSegmento(segmento: SegmentoPlano, cambios: Partial<SegmentoPlano>): SegmentoPlano {
  return { ...segmento, ...cambios };
}

export interface ResultadoEliminarNodo {
  nodos: NodoPlano[];
  segmentos: SegmentoPlano[];
  habitaciones: HabitacionPlano[];
  rutasConductor: RutaConductorPlano[];
}

/**
 * Elimina un nodo y, en cascada, los segmentos que lo usaban, las
 * habitaciones que lo tenían como vértice y las rutas de conductor que
 * lo usaban (no quedan apuntando a un id muerto) — mismo criterio que
 * liberarCircuitosDeTablero.
 */
export function eliminarNodo(
  nodoId: string,
  nodos: NodoPlano[] = [],
  segmentos: SegmentoPlano[] = [],
  habitaciones: HabitacionPlano[] = [],
  rutasConductor: RutaConductorPlano[] = []
): ResultadoEliminarNodo {
  return {
    nodos: nodos.filter((n) => n.id !== nodoId),
    segmentos: segmentos.filter((s) => s.nodoAId !== nodoId && s.nodoBId !== nodoId),
    habitaciones: habitaciones.filter((h) => !h.nodoIds.includes(nodoId)),
    rutasConductor: rutasConductor.filter((r) => !r.nodoIds.includes(nodoId)),
  };
}

export function eliminarSegmento(segmentoId: string, segmentos: SegmentoPlano[] = []): SegmentoPlano[] {
  return segmentos.filter((s) => s.id !== segmentoId);
}

/**
 * Traslada un GRUPO de nodos (ej. todos los de una habitación) por
 * `deltaM` (metros) — para arrastrar un ambiente entero de un lugar a
 * otro del plano, manteniendo su forma exacta (es la misma operación
 * aplicada a cada nodo, no se recalcula nada). Genérica a propósito —
 * no es "mover habitación", es "mover estos nodos"; quien llama decide
 * cuáles (hoy: los nodoIds de una habitación; en el futuro, podría
 * servir para arrastrar una ruta de conductor completa igual).
 */
export function moverNodos(nodoIds: string[], deltaM: Punto, nodos: NodoPlano[] = []): NodoPlano[] {
  const idsAMover = new Set(nodoIds);
  return nodos.map((n) =>
    idsAMover.has(n.id) ? { ...n, punto: { x: n.punto.x + deltaM.x, y: n.punto.y + deltaM.y } } : n
  );
}

/**
 * Registra una habitación a partir de una cadena de nodos YA cerrada
 * (el último igual al primero no hace falta repetirlo — ver nota de
 * Fase 1 arriba). Calcula área/perímetro de una — no se vuelven a
 * tocar a mano después (mismo criterio anti-doble-escritura que el
 * resto de la app: son datos DERIVADOS del grafo, no una segunda copia).
 */
export function crearHabitacion(nodoIds: string[], nodos: NodoPlano[] = [], nombre: string = ""): HabitacionPlano | null {
  const puntos = nodoIds.map((id) => nodos.find((n) => n.id === id)?.punto).filter((p): p is Punto => Boolean(p));
  if (puntos.length < 3) return null;
  return {
    id: generarId(),
    nodoIds,
    nombre: nombre?.trim() || "Ambiente sin nombre",
    areaM2: areaPoligono(puntos),
    perimetroM: perimetroPoligono(puntos),
    alturaM: null,
    exterior: false,
    tipoAmbiente: "otro",
  };
}

/**
 * El ambiente (si alguno) que contiene `puntoModelo` — usuario,
 * 2026-11-25: para que un equipo colocado en el plano herede
 * "interior"/"exterior" del ambiente donde cae, sin pedirlo aparte.
 * Mismo point-in-polygon que ya usa PlanoCanvas.jsx para el hit-test
 * de "Mover ambiente", pero en espacio MODELO (no imagen) y expuesto
 * acá para que el hook/UI lo puedan usar sin duplicar la lógica. Si
 * dos ambientes se superponen, gana el primero que los contenga (el
 * orden de creación) — caso raro, no se resuelve con más precisión
 * porque superponer ambientes a propósito no es un uso soportado.
 */
export function habitacionQueContiene(puntoModelo: Punto, habitaciones: HabitacionPlano[] = [], nodos: NodoPlano[] = []): HabitacionPlano | null {
  for (const h of habitaciones) {
    const puntos = h.nodoIds.map((id) => nodos.find((n) => n.id === id)?.punto).filter((p): p is Punto => Boolean(p));
    if (puntos.length >= 3 && puntoDentroDePoligono(puntoModelo, puntos)) return h;
  }
  return null;
}

// --- Generador de ambiente por dimensión conocida (2026-11-20) ---
//
// Pedido explícito del usuario: escribir una etiqueta + un ancho×alto
// ya conocidos (ej. "Habitación #1, 12×8m") y que aparezca un
// rectángulo de ESE tamaño exacto en el plano, en vez de tener que
// trazarlo a mano punto por punto — "que puedas arrastrar" después
// (ver moverNodos arriba, usado por PlanoCanvas.jsx en el modo
// "Mover ambiente"). Deliberadamente NO reusa nodoCercano/el pegado
// de 30cm: son 4 nodos NUEVOS siempre, para no fusionar sin querer con
// una pared manual cercana — si el usuario SÍ quiere conectarlas, basta
// con trazar una pared a mano después, que si se pega sola (eso ya
// funciona con cualquier nodo del grafo, generado o manual).
//
// Reusa crearNodo/crearSegmento/crearHabitacion tal cual (nunca una
// segunda fábrica paralela) — el resultado es indistinguible de una
// habitación trazada a mano: se puede seguir editando con las mismas
// herramientas (borrar un nodo, agregar una pared, etc.).
export interface ResultadoHabitacionRectangular {
  nodos: NodoPlano[];
  segmentos: SegmentoPlano[];
  habitacion: HabitacionPlano | null;
}

export function crearHabitacionRectangular(centroModelo: Punto, anchoM: number, altoM: number, nombre: string = ""): ResultadoHabitacionRectangular | null {
  if (!(anchoM > 0) || !(altoM > 0)) return null;
  const puntos = puntosRectangulo(centroModelo, anchoM, altoM);
  const nodos = puntos.map((p) => crearNodo(p));
  const segmentos = nodos.map((n, i) => crearSegmento(n.id, nodos[(i + 1) % nodos.length].id, "pared"));
  const habitacion = crearHabitacion(
    nodos.map((n) => n.id),
    nodos,
    nombre
  );
  return { nodos, segmentos, habitacion };
}

// --- Rutas de conductor — Fase 2, 3ra ronda (2026-11-20) ---
//
// Misma idea que una habitación, pero para una cadena de nodos
// ABIERTA (una ruta de punto a punto, no un lazo cerrado): los
// segmentos que la forman ya se crean con crearSegmento(... , "conductor")
// — igual mecanismo de trazado/"pegado" que las paredes, reutilizado
// tal cual, solo cambia el `tipo` del segmento. Acá solo se registra
// la ruta COMPLETA (qué nodos la forman, en orden) + su longitud total
// — derivada, nunca una segunda copia editable a mano.

/** Registra una ruta de conductor a partir de una cadena de nodos (abierta, >= 2). */
export function crearRutaConductor(nodoIds: string[], nodos: NodoPlano[] = [], nombre: string = ""): RutaConductorPlano | null {
  const puntos = nodoIds.map((id) => nodos.find((n) => n.id === id)?.punto).filter((p): p is Punto => Boolean(p));
  if (puntos.length < 2) return null;
  return {
    id: generarId(),
    nodoIds,
    nombre: nombre?.trim() || "Ruta sin nombre",
    longitudM: longitudPolilinea(puntos),
    entidadId: null,
    entidadTipo: null,
  };
}

export function eliminarRutaConductor(rutaId: string, rutas: RutaConductorPlano[] = []): RutaConductorPlano[] {
  return rutas.filter((r) => r.id !== rutaId);
}

/**
 * Rutas que apuntaban a una entidad eliminada (circuito/tablero) quedan
 * desvinculadas (entidadId/entidadTipo -> null), nunca apuntando a un id
 * muerto — mismo criterio que liberarMarcadoresDeEntidad. Bug real
 * encontrado en auditoría (usuario, 2026-11-26, "verificá que no hay
 * datos huérfanos"): eliminarCircuito/eliminarTablero ya liberaban
 * marcadores del plano, pero nunca las rutas de conductor vinculadas.
 */
export function liberarRutasDeEntidad(entidadId: string, rutas: RutaConductorPlano[] = []): RutaConductorPlano[] {
  return rutas.map((r) => (r.entidadId === entidadId ? { ...r, entidadId: null, entidadTipo: null } : r));
}

/**
 * Vincula (o desvincula, con `entidadId: null`) una ruta a un circuito
 * o tablero cuya distancia/alimentador se puede autocompletar desde
 * ella — usuario, 2026-11-22, "autocompletar la distancia del
 * circuito/alimentador desde la longitud ya trazada en el plano".
 * Mismo criterio de vínculo que MarcadorEquipoPlano.entidadId: la ruta
 * es una VISTA que apunta a la entidad real, nunca duplica su dato.
 */
export function vincularRutaConductor(ruta: RutaConductorPlano, entidadId: string | null, entidadTipo: EntidadVinculadaRuta | null = null): RutaConductorPlano {
  return { ...ruta, entidadId: entidadId || null, entidadTipo: entidadId ? entidadTipo : null };
}

// --- Equipos ubicados en el plano — Fase 2, 3ra ronda (2026-11-20) ---
//
// Un marcador puntual (no forma parte del grafo de nodos/segmentos —
// ver la nota en PlanoInteligente.jsx sobre por qué quedan
// independientes en esta ronda) con un `tipo` del MISMO catálogo que
// ya usa el diagrama unifilar (shared/data/bibliotecaComponentes.js —
// ver PlanoMediator para `obtenerComponente`/`componentesPorCategoria`
// reexportados, nunca un segundo catálogo) y un `entidadId` opcional
// que lo vincula a un tablero/circuito/equipo/fuenteEnergia/
// transformador YA existente en el proyecto — mismo "modelo canónico"
// de ARCHITECTURE.md §9 (el marcador es una VISTA sobre la entidad
// real, nunca duplica sus datos eléctricos).
//
// DECISIÓN DELIBERADA: la lista de "entidades ya vinculadas" para
// excluir de los candidatos es PROPIA del plano (no cruza con los
// vínculos que ya tenga el diagrama unifilar) — la misma entidad
// (ej. un tablero) puede aparecer legítimamente en ambas vistas a la
// vez: el diagrama muestra su TOPOLOGÍA eléctrica, el plano su
// UBICACIÓN física — no es el mismo recurso "usado dos veces", son
// dos aspectos distintos del mismo dato.

export function crearMarcadorEquipo(puntoModelo: Punto, tipo: string, entidadId: string | null = null, nombre: string = ""): MarcadorEquipoPlano {
  return { id: generarId(), punto: puntoModelo, tipo, entidadId: entidadId || null, nombre: nombre?.trim() || "", controlaMarcadorId: null };
}

export function editarMarcadorEquipo(marcador: MarcadorEquipoPlano, cambios: Partial<MarcadorEquipoPlano>): MarcadorEquipoPlano {
  return { ...marcador, ...cambios };
}

export function eliminarMarcadorEquipo(marcadorId: string, marcadores: MarcadorEquipoPlano[] = []): MarcadorEquipoPlano[] {
  return marcadores.filter((m) => m.id !== marcadorId);
}

/** Marcadores que apuntaban a una entidad eliminada quedan desvinculados (entidadId -> null), nunca borrados ni apuntando a un id muerto. */
export function liberarMarcadoresDeEntidad(entidadId: string, marcadores: MarcadorEquipoPlano[] = []): MarcadorEquipoPlano[] {
  return marcadores.map((m) => (m.entidadId === entidadId ? { ...m, entidadId: null } : m));
}
