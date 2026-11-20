import { generarId } from "../../shared/utils/id.js";
import { TIPO_INSTALACION_POR_DEFECTO, TIPOS_INSTALACION } from "../../shared/constants/constantes.js";

// Migración del enum viejo de tipoInstalacion (2 valores: domiciliaria/
// industrial) al nuevo de 3 (ver la nota larga en shared/constants/
// constantes.js) — un archivo guardado antes de 2026-11-19 trae el
// valor viejo tal cual, nunca se reescribe el archivo del usuario, solo
// se traduce al cargarlo. "industrial" mapea a COMERCIAL_INDUSTRIAL (el
// nivel más cercano a su intención original); "domiciliaria" al nuevo
// default RESIDENCIAL_BASICO.
const MIGRACION_TIPO_INSTALACION = {
  domiciliaria: TIPOS_INSTALACION.RESIDENCIAL_BASICO,
  industrial: TIPOS_INSTALACION.COMERCIAL_INDUSTRIAL,
};

function migrarTipoInstalacion(valor) {
  if (!valor) return TIPO_INSTALACION_POR_DEFECTO;
  if (Object.values(TIPOS_INSTALACION).includes(valor)) return valor;
  return MIGRACION_TIPO_INSTALACION[valor] ?? TIPO_INSTALACION_POR_DEFECTO;
}

// Plano vacío — ver modules/plano/index.js y PLANO_INTELIGENTE_DISENO.md.
// `imagen` guarda el archivo cargado como data URL (embebido en el
// propio JSON del proyecto) — necesario para que el plano se vea
// IGUAL al compartir el proyecto entre dispositivos (ver la tabla de
// escenarios del diseño): si la imagen no viaja con el archivo, el
// fondo de referencia desaparecería al abrirlo en otra máquina, aunque
// las medidas (que sí viven en metros, no en la imagen) sigan intactas.
export function planoVacio() {
  return { imagen: null, calibracion: null, nodos: [], segmentos: [], habitaciones: [] };
}

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
export function serializarProyecto({ proyecto, normativaActiva, tipoInstalacion, circuitos, equipos, tableros, fuentesEnergia, transformadores, nodosDiagrama, conexionesDiagrama, plano }) {
  return {
    formatoVersion: 1,
    proyecto: { ...proyecto, fechaModificacion: new Date().toISOString() },
    normativaActiva,
    tipoInstalacion: tipoInstalacion ?? TIPO_INSTALACION_POR_DEFECTO,
    circuitos,
    equipos,
    tableros: tableros ?? [],
    fuentesEnergia: fuentesEnergia ?? [],
    transformadores: transformadores ?? [],
    nodosDiagrama: nodosDiagrama ?? [],
    conexionesDiagrama: conexionesDiagrama ?? [],
    plano: plano ?? planoVacio(),
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
    // Compatibilidad: archivos sin tipoInstalacion caen al default; con
    // el enum viejo (domiciliaria/industrial) se migran al nuevo de 3
    // niveles — ver migrarTipoInstalacion arriba.
    tipoInstalacion: migrarTipoInstalacion(data.tipoInstalacion),
    circuitos: data.circuitos,
    equipos: data.equipos,
    // Compatibilidad: archivos guardados antes de Fase 3 no traen tableros.
    tableros: Array.isArray(data.tableros) ? data.tableros : [],
    // Compatibilidad: archivos guardados antes de esta sesión no traen
    // fuentesEnergia.
    fuentesEnergia: Array.isArray(data.fuentesEnergia) ? data.fuentesEnergia : [],
    // Compatibilidad: archivos guardados antes de conectar Transformador
    // como origen seleccionable no traen transformadores.
    transformadores: Array.isArray(data.transformadores) ? data.transformadores : [],
    // Compatibilidad: archivos guardados antes del diagrama unifilar
    // (Fase 1) no traen nodos/conexiones.
    nodosDiagrama: Array.isArray(data.nodosDiagrama) ? data.nodosDiagrama : [],
    conexionesDiagrama: Array.isArray(data.conexionesDiagrama) ? data.conexionesDiagrama : [],
    // Compatibilidad: archivos guardados antes del plano inteligente
    // (Fase 1, 2026-11-20) no traen `plano` — cae al vacío.
    plano: data.plano && typeof data.plano === "object" ? { ...planoVacio(), ...data.plano } : planoVacio(),
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
