/**
 * Módulo Persistencia — serialización JSON del proyecto.
 * SQLite / importador PDF quedan como ganchos futuros.
 */
export {
  proyectoVacio,
  planoVacio,
  serializarProyecto,
  deserializarProyecto,
  nombreArchivo,
} from "./proyecto.ts";

export type { ProyectoMeta, PlanoProyecto, DatosSerializarProyecto, ProyectoSerializado } from "./tipos.ts";
