// Entidad Transformador — creada a pedido explícito del usuario
// ("crea el objeto pero no lo conectes"), en el mismo nivel que
// canalizacion.js y cortocircuito.js en este archivo: módulo puro,
// exportado desde modules/motor/index.js y expuesto en
// MotorCalculoMediator, pero SIN llamador — ni useCircuitos.js, ni
// ningún componente, ni resolverOrigen() (modules/origen/index.js) lo
// invocan todavía. Ese comentario en origen/index.js sigue vigente:
// Transformador se conecta cuando se desarrolle el sistema de media
// tensión, o antes si aparece una necesidad real de baja tensión.
//
// Por eso esto es deliberadamente chico: la forma del dato y el único
// cálculo que se desprende directamente de su identidad (corriente
// nominal primaria/secundaria). NO incluye %Z aplicado a cortocircuito,
// ni derateo térmico, ni acoplamiento con caídaTensionAcumulada — eso
// queda para cuando haya un proyecto real que lo necesite (mismo
// criterio que el resto del "pendiente" documentado en origen/index.js).

/** Forma de un Transformador. conexionPrimaria/Secundaria toman valores
 * de TIPOS_CONEXION_EQUIPO (shared/data/equiposEspeciales.js) — delta o
 * estrella, ya que un transformador no usa serie/paralelo entre
 * devanados. "" = sin asignar todavía; no se valida aquí a propósito
 * (scaffold — "después vemos los detalles"). */
export const TRANSFORMADOR_VACIO = {
  nombre: "",
  capacidadKVA: "",
  fases: "tri", // "mono" | "tri"
  tensionPrimariaV: "",
  tensionSecundariaV: "",
  conexionPrimaria: "",
  conexionSecundaria: "",
  impedanciaPct: "", // %Z de placa — pendiente de uso (ver cortocircuito.js)
  notas: "",
};

/**
 * Normaliza datos crudos (ej. de un futuro formulario) a la forma de
 * TRANSFORMADOR_VACIO, sin inventar valores — igual criterio que
 * tablero/index.js normalizar().
 */
export function normalizarTransformador(datos = {}) {
  return { ...TRANSFORMADOR_VACIO, ...datos };
}

/**
 * Corriente nominal de placa en cada devanado, a partir de capacidad y
 * tensión — fórmula directa, no depende de carga real conectada.
 * Nunca devuelve 0 por datos faltantes: si falta algo, lo dice.
 *
 * @param {{capacidadKVA: number|string, fases: "mono"|"tri", tensionPrimariaV: number|string, tensionSecundariaV: number|string}} transformador
 * @returns {{disponible: boolean, motivo?: string, corrientePrimariaA?: number, corrienteSecundariaA?: number}}
 */
export function calcularCorrientesNominales(transformador) {
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
