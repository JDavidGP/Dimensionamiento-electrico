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
};

/** Categorías de equipo especial que usan este esquema de conexión. */
export const TIPOS_EQUIPO_ESPECIAL = {
  MOTOR: "motor",
  CONTACTOR: "contactor",
  TRANSFORMADOR: "transformador",
};

// Qué conexiones tiene sentido ofrecer por tipo de equipo. Un motor o
// un transformador trifásico se conectan en delta o estrella entre sus
// devanados/bobinados; un contactor (o un banco de ellos) se arma en
// serie o paralelo según la maniobra. "etc" queda abierto a propósito:
// esta lista crece cuando aparezca un caso real que lo pida, no antes.
export const CONEXIONES_DISPONIBLES_POR_DEFECTO = {
  [TIPOS_EQUIPO_ESPECIAL.MOTOR]: [TIPOS_CONEXION_EQUIPO.DELTA, TIPOS_CONEXION_EQUIPO.ESTRELLA],
  [TIPOS_EQUIPO_ESPECIAL.CONTACTOR]: [TIPOS_CONEXION_EQUIPO.SERIE, TIPOS_CONEXION_EQUIPO.PARALELO],
  [TIPOS_EQUIPO_ESPECIAL.TRANSFORMADOR]: [TIPOS_CONEXION_EQUIPO.DELTA, TIPOS_CONEXION_EQUIPO.ESTRELLA],
};

/** Forma de un equipo especial — scaffold, sin plantilla de formulario
 * asociada todavía (ni en shared/data/plantillas.js ni en
 * validacion/formularios.js). */
export const EQUIPO_ESPECIAL_VACIO = {
  tipo: "", // una clave de TIPOS_EQUIPO_ESPECIAL
  conexion: "", // una clave de TIPOS_CONEXION_EQUIPO, válida para ese tipo
  notas: "",
};
