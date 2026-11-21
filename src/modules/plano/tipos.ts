// src/modules/plano/tipos.ts
//
// Tipos del dominio Plano — grafo de nodos/segmentos (paredes/
// conductores) en espacio MODELO (metros reales), habitaciones y rutas
// derivadas, marcadores de equipo, y la calibración de escala que los
// conecta con el espacio IMAGEN (píxeles del archivo cargado). Ver
// PLANO_INTELIGENTE_DISENO.md para el porqué completo de la separación
// de espacios de coordenadas.
//
// Reusa Punto de modules/geometria/ (ya migrado) — un punto acá puede
// estar en espacio modelo (metros) o espacio imagen (píxeles) según el
// campo, el tipo en sí es el mismo, solo cambia la unidad según el uso.

import type { Punto } from "../geometria/tipos.ts";

export type { Punto };

export interface NodoPlano {
  id: string;
  punto: Punto;
}

export type TipoSegmento = "pared" | "conductor";

export interface SegmentoPlano {
  id: string;
  nodoAId: string;
  nodoBId: string;
  tipo: TipoSegmento;
  /** Espesor medido de la pared, en metros — "" = no medido todavía. Solo tiene sentido para tipo "pared". */
  espesorM: number | "";
}

export interface HabitacionPlano {
  id: string;
  nodoIds: string[];
  nombre: string;
  areaM2: number;
  perimetroM: number;
}

export type EntidadVinculadaRuta = "circuito" | "tablero";

export interface RutaConductorPlano {
  id: string;
  nodoIds: string[];
  nombre: string;
  longitudM: number;
  /** Circuito o tablero cuya distancia/alimentador se puede autocompletar desde esta ruta (ver vincularRutaConductor, PlanoMediator.candidatosEntidadRuta). null = sin vincular. */
  entidadId: string | null;
  /** "circuito" (distancia del circuito) o "tablero" (longitudAlimentador) — qué campo autocompletar. null si entidadId es null. */
  entidadTipo: EntidadVinculadaRuta | null;
}

export interface MarcadorEquipoPlano {
  id: string;
  punto: Punto;
  tipo: string;
  entidadId: string | null;
  nombre: string;
}

export interface CalibracionDosPuntos {
  metodo: "dos_puntos";
  puntoA: Punto;
  puntoB: Punto;
  distanciaRealM: number;
  escalaMetrosPorPixel: number;
}

export interface CalibracionPorPerimetro {
  metodo: "perimetro";
  puntosContorno: Punto[];
  perimetroRealM: number;
  escalaMetrosPorPixel: number;
}

export type CalibracionPlano = CalibracionDosPuntos | CalibracionPorPerimetro;

export type ResultadoCalibracion = { ok: true; calibracion: CalibracionPlano } | { ok: false; motivo: string };

export type OrientacionLinea = "horizontal" | "vertical";

export interface LineaCandidata {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  orientacion: OrientacionLinea;
}

export interface ResultadoDeteccionParedes {
  paredes: LineaCandidata[];
  puertas: LineaCandidata[];
}

export interface DatosExportarDXF {
  nodos?: NodoPlano[];
  segmentos?: SegmentoPlano[];
  habitaciones?: HabitacionPlano[];
}

export interface RangoIndice {
  inicio: number;
  fin: number;
}
