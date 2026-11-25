// src/modules/persistencia/tipos.ts
//
// Formas del archivo de proyecto serializado (.json) — reusa
// Circuito/Equipo de modules/validacion/tipos.ts y Tablero/
// FuenteEnergia/Transformador de los módulos correspondientes donde
// hace sentido estructural. nodosDiagrama/conexionesDiagrama y los
// campos del plano quedan como `unknown[]`/`unknown` a propósito: esos
// dominios (diagrama/plano) todavía no están migrados a TypeScript, y
// este módulo nunca lee su contenido interno — solo lo empaqueta/
// desempaqueta tal cual, de ida y de vuelta.

import type { Circuito, Equipo, Tablero, FuenteEnergia, Transformador, Diferencial } from "../validacion/tipos.ts";

export interface ProyectoMeta {
  id?: string;
  nombre: string;
  fechaCreacion: string;
  fechaModificacion: string;
}

export interface PlanoProyecto {
  imagen: unknown | null;
  calibracion: unknown | null;
  alturaTechoM: number | null;
  nodos: unknown[];
  segmentos: unknown[];
  habitaciones: unknown[];
  rutasConductor: unknown[];
  marcadoresEquipo: unknown[];
}

/** Argumentos de serializarProyecto() — lo que el hook tiene en memoria mientras trabaja. */
export interface DatosSerializarProyecto {
  proyecto: Partial<ProyectoMeta>;
  normativaActiva: string;
  tipoInstalacion?: string;
  circuitos: Circuito[];
  equipos: Equipo[];
  tableros?: Tablero[];
  fuentesEnergia?: FuenteEnergia[];
  transformadores?: Transformador[];
  diferenciales?: Diferencial[];
  nodosDiagrama?: unknown[];
  conexionesDiagrama?: unknown[];
  plano?: Partial<PlanoProyecto> | null;
}

/** El archivo .json tal cual se guarda/abre — formatoVersion incluido por si cambia la estructura y hay que migrar archivos viejos. */
export interface ProyectoSerializado {
  formatoVersion: number;
  proyecto: ProyectoMeta;
  normativaActiva: string;
  tipoInstalacion: string;
  circuitos: Circuito[];
  equipos: Equipo[];
  tableros: Tablero[];
  fuentesEnergia: FuenteEnergia[];
  transformadores: Transformador[];
  diferenciales: Diferencial[];
  nodosDiagrama: unknown[];
  conexionesDiagrama: unknown[];
  plano: PlanoProyecto;
}
