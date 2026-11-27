// Configuración de equipos especiales (motores, contactores,
// transformadores) — a pedido explícito del usuario: "una configuración
// para equipos especiales [...] donde se pueda modificar las conexiones
// delta, estrella, serie, paralelo etc, después vemos los detalles".
//
// Es deliberadamente un scaffold: define los tipos de conexión y qué
// conexiones aplican por tipo de equipo, pero NO está conectado a
// ningún formulario, componente ni mediator todavía — mismo criterio
// de "crear sin conectar" que modules/motor/transformador.js. Los
// valores por defecto de abajo son un punto de partida razonable, no
// una tabla normativa cerrada; se pueden ajustar en runtime vía
// Config.equiposEspeciales (ver core/services/Config.js) sin tocar
// este archivo.

/** Tipos de conexión eléctrica aplicables a equipos especiales. */
export const TIPOS_CONEXION_EQUIPO = {
  DELTA: "delta",
  ESTRELLA: "estrella",
  SERIE: "serie",
  PARALELO: "paralelo",
} as const;
export type TipoConexionEquipo = (typeof TIPOS_CONEXION_EQUIPO)[keyof typeof TIPOS_CONEXION_EQUIPO];

/** Categorías de equipo especial que usan este esquema de conexión. */
export const TIPOS_EQUIPO_ESPECIAL = {
  MOTOR: "motor",
  CONTACTOR: "contactor",
  TRANSFORMADOR: "transformador",
} as const;
export type TipoEquipoEspecial = (typeof TIPOS_EQUIPO_ESPECIAL)[keyof typeof TIPOS_EQUIPO_ESPECIAL];

// Qué conexiones tiene sentido ofrecer por tipo de equipo. Un motor o
// un transformador trifásico se conectan en delta o estrella entre sus
// devanados/bobinados; un contactor (o un banco de ellos) se arma en
// serie o paralelo según la maniobra. "etc" queda abierto a propósito:
// esta lista crece cuando aparezca un caso real que lo pida, no antes.
export const CONEXIONES_DISPONIBLES_POR_DEFECTO: Record<TipoEquipoEspecial, TipoConexionEquipo[]> = {
  [TIPOS_EQUIPO_ESPECIAL.MOTOR]: [TIPOS_CONEXION_EQUIPO.DELTA, TIPOS_CONEXION_EQUIPO.ESTRELLA],
  [TIPOS_EQUIPO_ESPECIAL.CONTACTOR]: [TIPOS_CONEXION_EQUIPO.SERIE, TIPOS_CONEXION_EQUIPO.PARALELO],
  [TIPOS_EQUIPO_ESPECIAL.TRANSFORMADOR]: [TIPOS_CONEXION_EQUIPO.DELTA, TIPOS_CONEXION_EQUIPO.ESTRELLA],
};

/** Forma de un equipo especial — scaffold, sin plantilla de formulario
 * asociada todavía (ni en shared/data/plantillas.ts ni en
 * modules/validacion/formularios.ts). */
export interface EquipoEspecial {
  /** Una clave de TIPOS_EQUIPO_ESPECIAL, o "" mientras no se eligió. */
  tipo: TipoEquipoEspecial | "";
  /** Una clave de TIPOS_CONEXION_EQUIPO válida para ese tipo, o "" mientras no se eligió. */
  conexion: TipoConexionEquipo | "";
  notas: string;
}
export const EQUIPO_ESPECIAL_VACIO: EquipoEspecial = {
  tipo: "",
  conexion: "",
  notas: "",
};

// NOTA PARA MÁS ADELANTE (usuario, 2026-11-19 — sin desarrollar
// todavía, no implementar sin un proyecto real que lo necesite):
// agregar un tipo de instalación (domiciliaria vs. industrial) que
// filtre o ajuste qué aparece acá — una instalación industrial
// necesita configuraciones de motores de alto consumo y
// transformadores que no tiene sentido mostrarle por defecto a una
// instalación domiciliaria (ruido en la UI, no un límite técnico).
// UBICACIÓN DECIDIDA (usuario, mensaje posterior): el tipo de
// instalación se elige junto con la normativa, en
// SelectorNormativa.jsx (ver la nota agregada ahí) — una vez elegido
// ahí, filtra/ajusta qué aparece en este archivo, no al revés.
// Ver también la nota gemela (misma fecha) en modules/origen/index.js,
// del lado de "de dónde viene la energía" — ambas notas describen el
// mismo objetivo del usuario: mantener la aplicación limpia para el
// caso común, con lo avanzado disponible pero no impuesto.
