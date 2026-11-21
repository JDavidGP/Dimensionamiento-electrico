// src/modules/diagrama/tipos.ts
//
// Forma de Nodo/Conexión del diagrama unifilar — el modelo canónico
// completo del proyecto (circuitos/equipos/tableros/fuentesEnergia)
// sigue viviendo en hooks/useCircuitos.js (en JS hasta la etapa de
// componentes/hooks de la migración); acá solo lo propio de este
// dominio (ver ARCHITECTURE.md §9, "anti-bucle tabla ↔ diagrama").

import type { Punto } from "../geometria/index.ts";

export interface NodoDiagrama {
  id?: string;
  /** id del catálogo (shared/data/bibliotecaComponentes.js) */
  tipo: string;
  nombre: string;
  posicion: Punto;
  /** Si el tipo tiene entidadVinculada, el id de la entidad real que este nodo representa. null = sin vincular. */
  entidadId: string | null;
  /** Forma libre a propósito — complementa (no reemplaza) los datos de la entidad vinculada si la hay. */
  propiedades: Record<string, unknown>;
  estado: "activo" | "desactivado" | "falla";
}

export type DatosNodo = Partial<Omit<NodoDiagrama, "id">>;

export interface ConexionDiagrama {
  id?: string;
  nodoOrigenId: string;
  nodoDestinoId: string;
  /** "cable" | "barra" — lo suficiente para distinguir un conductor de una barra de distribución. */
  tipoConductor: string;
  longitud: number | "";
  /** AWG/kcmil — reusa AREA_MM2_POR_AWG cuando se calcule, no se recalcula acá. */
  calibre: string;
  material: string;
  /** "mono" | "bi" | "tri" — mismo vocabulario que circuito/tablero. */
  fases: string;
  notas: string;
}

export type DatosConexion = Partial<Omit<ConexionDiagrama, "id">>;

export type ResultadoValidacion = { valido: true } | { valido: false; motivo: string };

/** Forma de una entrada del catálogo (shared/data/bibliotecaComponentes.js). */
export interface Componente {
  id: string;
  nombre: string;
  categoria: string;
  puntosConexion: { entradas: number; salidas: number };
  entidadVinculada: string | null;
}
