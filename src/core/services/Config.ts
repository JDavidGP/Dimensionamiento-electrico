import { CONEXIONES_DISPONIBLES_POR_DEFECTO } from "../../shared/data/equiposEspeciales.ts";
import type { TipoEquipoEspecial, TipoConexionEquipo } from "../../shared/data/equiposEspeciales.ts";

export interface LimitesConfig {
  caidaTensionPct: number;
  factorCargaContinua: number;
  desbalanceFasesPct: number;
}

export interface FeaturesConfig {
  diagrama: boolean;
  documentoPdf: boolean;
  sqlite: boolean;
}

export interface EquiposEspecialesConfig {
  conexionesDisponibles: Record<TipoEquipoEspecial, TipoConexionEquipo[]>;
}

export interface ConfigParcial {
  formatoVersion?: number;
  normativaPorDefecto?: string;
  idioma?: string;
  limites?: Partial<LimitesConfig>;
  features?: Partial<FeaturesConfig>;
  equiposEspeciales?: { conexionesDisponibles?: Partial<Record<TipoEquipoEspecial, TipoConexionEquipo[]>> };
}

export interface ConfigApp {
  formatoVersion: number;
  normativaPorDefecto: string;
  idioma: string;
  limites: LimitesConfig;
  features: FeaturesConfig;
  equiposEspeciales: EquiposEspecialesConfig;
  set(partial: ConfigParcial): void;
}

/**
 * Configuración global de la aplicación.
 * Valores por defecto; pueden sobrescribirse en runtime.
 */
export const Config: ConfigApp = {
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
  // shared/data/equiposEspeciales.ts para los tipos y el razonamiento
  // de los valores por defecto.
  equiposEspeciales: {
    conexionesDisponibles: { ...CONEXIONES_DISPONIBLES_POR_DEFECTO },
  },
  set(partial: ConfigParcial): void {
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
