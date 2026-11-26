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
import type { TipoAmbiente } from "./proteccionGFCI.ts";

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
  /** Altura de techo propia de este ambiente (piso a viga corona), en metros. null = usa la altura general del plano. */
  alturaM: number | null;
  /** Instalación de interiores o de exteriores (usuario, 2026-11-25) — false = interior (default). Un cobertizo, un cuarto de bomba separado, una zona de patio/jardín: cada uno es OTRO ambiente marcado exterior=true, no una jerarquía nueva de terreno/edificación. */
  exterior: boolean;
  /** Función del ambiente (baño/cocina/garaje/...) — usuario, 2026-11-25/26, para saber dónde exige GFCI el NEC (ver modules/plano/proteccionGFCI.ts). "otro" = default, sin requerimiento propio. */
  tipoAmbiente: TipoAmbiente;
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
  /** Vínculo marcador-a-marcador (usuario, 2026-11-25): para un interruptor conmutado, el id del marcador de luminaria que controla — null si no aplica o todavía no se vinculó. Varios interruptores pueden apuntar a la MISMA luminaria (3/4 vías), a propósito: no es un vínculo exclusivo. Distinto de `entidadId` (que vincula a una entidad REAL del sistema — circuito/tablero/equipo/etc.), este vínculo es puramente geográfico/de plano. */
  controlaMarcadorId: string | null;
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
