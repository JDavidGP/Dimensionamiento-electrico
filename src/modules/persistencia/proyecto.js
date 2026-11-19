import { generarId } from "../../shared/utils/id.js";
import { TIPO_INSTALACION_POR_DEFECTO } from "../../shared/constants/constantes.js";

export function proyectoVacio() {
  return {
    id: generarId(),
    nombre: "Proyecto sin nombre",
    fechaCreacion: new Date().toISOString(),
    fechaModificacion: new Date().toISOString(),
  };
}

// Empaqueta el estado completo de la app en un solo objeto serializable.
// Este es el "documento" que se guarda/abre — versión de formato incluida
// por si en el futuro cambia la estructura y hay que migrar archivos viejos.
export function serializarProyecto({ proyecto, normativaActiva, tipoInstalacion, circuitos, equipos, tableros, fuentesEnergia }) {
  return {
    formatoVersion: 1,
    proyecto: { ...proyecto, fechaModificacion: new Date().toISOString() },
    normativaActiva,
    tipoInstalacion: tipoInstalacion ?? TIPO_INSTALACION_POR_DEFECTO,
    circuitos,
    equipos,
    tableros: tableros ?? [],
    fuentesEnergia: fuentesEnergia ?? [],
  };
}

// Reconstruye el estado de la app a partir de un archivo cargado. Valida
// lo mínimo indispensable para no reventar la app con un archivo corrupto
// o de otro formato.
export function deserializarProyecto(data) {
  if (!data || typeof data !== "object") {
    throw new Error("El archivo no contiene un proyecto válido.");
  }
  if (!Array.isArray(data.circuitos) || !Array.isArray(data.equipos)) {
    throw new Error("El archivo no tiene la estructura esperada (circuitos/equipos).");
  }
  return {
    proyecto: data.proyecto ?? proyectoVacio(),
    normativaActiva: data.normativaActiva ?? "NEC",
    // Compatibilidad: archivos guardados antes de esta sesión no traen
    // tipoInstalacion — caen al valor por defecto, no se inventa otra cosa.
    tipoInstalacion: data.tipoInstalacion ?? TIPO_INSTALACION_POR_DEFECTO,
    circuitos: data.circuitos,
    equipos: data.equipos,
    // Compatibilidad: archivos guardados antes de Fase 3 no traen tableros.
    tableros: Array.isArray(data.tableros) ? data.tableros : [],
    // Compatibilidad: archivos guardados antes de esta sesión no traen
    // fuentesEnergia.
    fuentesEnergia: Array.isArray(data.fuentesEnergia) ? data.fuentesEnergia : [],
  };
}

export function nombreArchivo(proyecto) {
  const slug = (proyecto.nombre || "proyecto")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const fecha = new Date().toISOString().slice(0, 10);
  return `${slug || "proyecto"}_${fecha}.json`;
}
