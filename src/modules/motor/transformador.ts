// Entidad Transformador — creada a pedido explícito del usuario
// ("crea el objeto pero no lo conectes"), en el mismo nivel que
// canalizacion.js y cortocircuito.js en este archivo.
//
// CONECTADO (usuario, 2026-11-19): "Transformador solo es origen
// seleccionable cuando se seleccione que la instalación es industrial
// [...] nos hace falta datos para desarrollar ese apartado" — por eso
// se conecta SOLO como origen seleccionable (registro, igual criterio
// que fuentesEnergia/conmutación: "registrar primero, calcular
// después"), NUNCA se integró evaluarCaidaAcumulada ni cortocircuito
// para que atraviesen un cambio de nivel de tensión primario/
// secundario — eso sigue siendo el pendiente real (ver el bloque
// PENDIENTE — Transformador, pasos 2 y 3, en modules/origen/index.js),
// necesita datos de un proyecto industrial real que todavía no hay.
//
// Por eso esto es deliberadamente chico: la forma del dato, su CRUD
// (igual patrón que fuentesEnergia.js: crear/editar/liberar) y el único
// cálculo que se desprende directamente de su identidad (corriente
// nominal primaria/secundaria). NO incluye %Z aplicado a cortocircuito,
// ni derateo térmico, ni acoplamiento con caídaTensionAcumulada.

import { generarId } from "../../shared/utils/id.js";

/** Forma de un Transformador. conexionPrimaria/Secundaria toman valores
 * de TIPOS_CONEXION_EQUIPO (shared/data/equiposEspeciales.js) — delta o
 * estrella, ya que un transformador no usa serie/paralelo entre
 * devanados. "" = sin asignar todavía; no se valida aquí a propósito
 * (scaffold — "después vemos los detalles"). */
export interface Transformador {
  id?: string;
  nombre: string;
  capacidadKVA: number | string;
  fases: "mono" | "tri";
  tensionPrimariaV: number | string;
  tensionSecundariaV: number | string;
  conexionPrimaria: string;
  conexionSecundaria: string;
  /** %Z de placa — usado en cortocircuito.ts (calcularImpedanciaTransformadorOhm) */
  impedanciaPct: number | string;
  /** "aceite" | "seco" | "" — para buscar X/R en la tabla de cortocircuito.ts (obtenerXRTransformador). "" = sin asignar, el cortocircuito en bornes sigue funcionando igual (ver nota de esa función). */
  tipoRefrigeracion: "aceite" | "seco" | "";
  notas: string;
}

export const TRANSFORMADOR_VACIO: Omit<Transformador, "id"> = {
  nombre: "",
  capacidadKVA: "",
  fases: "tri", // "mono" | "tri"
  tensionPrimariaV: "",
  tensionSecundariaV: "",
  conexionPrimaria: "",
  conexionSecundaria: "",
  impedanciaPct: "", // %Z de placa
  tipoRefrigeracion: "", // "aceite" | "seco" | "" — ver obtenerXRTransformador en cortocircuito.ts
  notas: "",
};

/**
 * Normaliza datos crudos (ej. de un futuro formulario) a la forma de
 * TRANSFORMADOR_VACIO, sin inventar valores — igual criterio que
 * tablero/index.js normalizar().
 */
export function normalizarTransformador(datos: Partial<Transformador> = {}): Omit<Transformador, "id"> {
  return { ...TRANSFORMADOR_VACIO, ...datos };
}

/** Fábrica de un transformador nuevo — mismo patrón que crearFuenteEnergia (modules/origen/fuentesEnergia.js). */
export function crearTransformador(datos: Partial<Transformador>): Transformador {
  return { id: generarId(), ...normalizarTransformador(datos) };
}

/** Devuelve el transformador con los cambios aplicados — no muta el original. */
export function editarTransformador(transformador: Transformador, cambios: Partial<Transformador>): Transformador {
  return { ...transformador, ...normalizarTransformador({ ...transformador, ...cambios }) };
}

export interface TableroConPadre {
  tableroPadreId?: string | null;
  [clave: string]: unknown;
}

/**
 * Al eliminar un transformador, los tableros que lo tenían como
 * `tableroPadreId` quedan sin padre (null = acometida), no apuntando a
 * un ID muerto — mismo criterio que liberarTablerosDeFuente.
 */
export function liberarTablerosDeTransformador<T extends TableroConPadre>(transformadorId: string, tableros: T[] = []): T[] {
  return tableros.map((t) => (t.tableroPadreId === transformadorId ? { ...t, tableroPadreId: null } : t));
}

export type ResultadoCorrientesNominales =
  | { disponible: false; motivo: string }
  | { disponible: true; corrientePrimariaA: number; corrienteSecundariaA: number };

/**
 * Corriente nominal de placa en cada devanado, a partir de capacidad y
 * tensión — fórmula directa, no depende de carga real conectada.
 * Nunca devuelve 0 por datos faltantes: si falta algo, lo dice.
 */
export function calcularCorrientesNominales(transformador: Pick<Transformador, "capacidadKVA" | "fases" | "tensionPrimariaV" | "tensionSecundariaV">): ResultadoCorrientesNominales {
  const kva = Number(transformador.capacidadKVA);
  const vp = Number(transformador.tensionPrimariaV);
  const vs = Number(transformador.tensionSecundariaV);

  if (!(kva > 0)) {
    return { disponible: false, motivo: "Falta capacidad (kVA) del transformador." };
  }
  if (!(vp > 0) || !(vs > 0)) {
    return { disponible: false, motivo: "Falta tensión primaria y/o secundaria del transformador." };
  }

  const divisor = transformador.fases === "tri" ? Math.sqrt(3) : 1;
  return {
    disponible: true,
    corrientePrimariaA: (kva * 1000) / (vp * divisor),
    corrienteSecundariaA: (kva * 1000) / (vs * divisor),
  };
}
