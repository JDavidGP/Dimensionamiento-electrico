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

/** "alumbrado" si el circuito tiene AL MENOS un equipo de iluminación (REBT lo clasifica así incluso en un circuito mixto — el límite más restrictivo), "otros_usos" solo si NINGÚN equipo es de iluminación. Ver claseCircuitoREBT en modules/motor/. */
export type ClaseCircuitoREBT = "alumbrado" | "otros_usos";

/**
 * Contexto que una normativa puede necesitar para decidir el límite de
 * caída de tensión de ESTE circuito en particular — usuario, 2026-11-21,
 * citas ITC-BT-19 §2.2.2 (RD 842/2002): el límite de REBT depende del
 * tipo de instalación (vivienda vs. otras), de si el circuito es
 * alumbrado u otros usos, y de si la instalación tiene un transformador
 * de distribución propio AT/BT (el origen de referencia se corre a la
 * salida del transformador, con un límite más laxo). NEC/CIEN no
 * necesitan este contexto — su `limiteCaidaTensionPct` sigue siendo un
 * número fijo, sin esta complejidad.
 */
export interface ContextoCaidaTensionREBT {
  tipoInstalacion: string;
  claseCircuito: ClaseCircuitoREBT;
  tieneTransformadorPropio: boolean;
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
  /**
   * Override de `limiteCaidaTensionPct` para ESTE circuito en particular
   * (ITC-BT-19 §2.2.2) — si la normativa no lo define (NEC/CIEN), el
   * llamador sigue usando el `limiteCaidaTensionPct` fijo de siempre.
   * Representa la caída del tramo PROPIO del circuito — igual criterio
   * conservador que ya tenían NEC/CIEN (un chequeo por segmento,
   * adicional al acumulado de abajo).
   */
  limiteCaidaTensionTramoPct?: (contexto: ContextoCaidaTensionREBT) => number;
  /**
   * Override del límite ACUMULADO (origen→punto de utilización) para
   * este circuito — en REBT, este es el número que describe
   * literalmente el texto de ITC-BT-19 (3/5% sin transformador propio,
   * 4,5/6,5% con uno). Si la normativa no lo define (NEC/CIEN), el
   * llamador sigue usando LIMITE_CAIDA_TENSION_ACUMULADA_PROVISIONAL_PCT.
   */
  limiteCaidaTensionAcumuladaPct?: (contexto: ContextoCaidaTensionREBT) => number;
  /**
   * Carga unitaria de alumbrado general por área (VA/m²) — NEC Tabla
   * 220.12, "Dwelling Unit": 33 VA/m² (equivalente a 3 VA/pie², mismo
   * valor publicado en la tabla, no una conversión propia). Usuario,
   * 2026-11-23: quería saber para qué sirve el área construida de un
   * plano — esto es lo que la conecta a un cálculo real. REBT (IEC_ES)
   * no define este campo — ahí el área es solo UN criterio (junto con
   * A/C central, calefacción eléctrica, carga de VE) para elegir el
   * grado de electrificación a mano (ver GRADOS_ELECTRIFICACION), no
   * alimenta una fórmula de VA directa.
   */
  cargaIluminacionGeneralVaPorM2?: number;
  validado: boolean;
  notaValidacion: string;
}
