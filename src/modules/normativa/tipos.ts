// src/modules/normativa/tipos.ts
//
// Forma de una "normativa resuelta" (NEC/CIEN/IEC_ES ya armadas, el
// objeto que de verdad circula por el motor de cálculo) — contrato
// completo, igual a CAMPOS_OBLIGATORIOS de index.js más los campos
// opcionales que alguna variante sí trae (canalizaciones, region,
// factorDiversidad). Vive acá (no en modules/motor/) porque la
// normativa es quien la DEFINE; motor/ y otros consumidores la
// importan como tipo, nunca al revés.

export type Material = "cobre" | "aluminio";
export type Fases = "mono" | "bi" | "tri";

/** Regla de demanda de un grupo de equipos del mismo tipoEquipoNEC — recibe las potencias (W) YA ajustadas por continuidad, devuelve la demanda del grupo en W. */
export type ReglaDemanda = (potenciasW: number[]) => number;

export interface TablaCanalizaciones {
  tiposDisponibles: string[];
  areaConductorAisladoIn2: Record<string, number>;
  areaInternaConductoIn2: Record<string, Record<string, number>>;
  ordenTamanos: string[];
  porcentajeLlenadoMaximo: (cantidadConductores: number) => number;
  notaValidacion: string;
}

export interface Normativa {
  id: string;
  nombre: string;
  familia: string;
  region?: string;
  unidadSeccion: string;
  ordenSecciones: Record<Material, string[]>;
  areaMm2PorSeccion: Record<string, number> | null;
  ampacidad: Record<Material, Record<string, number>>;
  reactanciaOhmKm: Record<string, number>;
  breakersComerciales: number[];
  limiteCaidaTensionPct: number;
  voltajesPorFase: Record<Fases, number[]>;
  factorTemperatura: (tempC: number) => number;
  reglasDemanda: Record<string, ReglaDemanda>;
  demandaPorDefecto: ReglaDemanda;
  /** Llenado de conducto (NEC Cap. 9) — dato opcional del contrato, no todas las normativas lo tienen todavía. */
  canalizaciones?: TablaCanalizaciones;
  /** Placeholder de IEC_ES, pendiente de nivel Tablero (REBT ITC-BT-10) — ver simultaneidadREBT.js. */
  factorDiversidad?: null;
  validado: boolean;
  notaValidacion: string;
}
