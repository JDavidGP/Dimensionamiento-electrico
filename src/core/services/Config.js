import { CONEXIONES_DISPONIBLES_POR_DEFECTO } from "../../shared/data/equiposEspeciales.js";

/**
 * Configuración global de la aplicación.
 * Valores por defecto; pueden sobrescribirse en runtime.
 */
export const Config = {
  formatoVersion: 1,
  normativaPorDefecto: "NEC",
  idioma: "es",
  limites: {
    caidaTensionPct: 3.0,
    factorCargaContinua: 1.25,
    // Umbral recomendado de desbalance de fases (10%, ver constantes.js
    // para la fuente/justificación). Modificable por proyecto vía
    // Config.set({ limites: { desbalanceFasesPct: N } }) — subirlo
    // dispara una advertencia seria en balanceFases(), no lo hace en
    // silencio.
    desbalanceFasesPct: 10.0,
  },
  features: {
    diagrama: false,
    documentoPdf: false,
    sqlite: false,
  },
  // Configuración para equipos especiales (motor/contactor/transformador)
  // — scaffold a pedido del usuario, sin conectar a UI todavía. Ver
  // shared/data/equiposEspeciales.js para los tipos y el razonamiento
  // de los valores por defecto.
  equiposEspeciales: {
    conexionesDisponibles: { ...CONEXIONES_DISPONIBLES_POR_DEFECTO },
  },
  set(partial) {
    // Fusiona limites/features/equiposEspeciales en el objeto existente
    // en vez de reemplazar la referencia — si no, Object.assign(this,
    // partial) sustituiría, ej., this.limites completo por solo lo
    // recibido, perdiendo las demás claves (ej. caidaTensionPct).
    const { limites, features, equiposEspeciales, ...resto } = partial;
    Object.assign(this, resto);
    if (limites) Object.assign(this.limites, limites);
    if (features) Object.assign(this.features, features);
    if (equiposEspeciales?.conexionesDisponibles) {
      Object.assign(this.equiposEspeciales.conexionesDisponibles, equiposEspeciales.conexionesDisponibles);
    }
  },
};
