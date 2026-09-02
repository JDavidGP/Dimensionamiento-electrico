/**
 * Biblioteca normativa — registro de hojas seleccionables.
 * Solo este archivo exporta el catálogo; la UI y el motor no importan
 * nec.js / cien.js / iec/* directamente (pasan por NormativaMediator).
 */
import { NEC } from "./nec.js";
import { CIEN } from "./cien.js";
import { IEC_ES } from "./iec/es.js";

// NO se agrega un campo de "tabla de simultaneidad" acá a propósito:
// investigado y descartado por falta de fuente a nivel de UN circuito
// (NEC 220 ya son reglasDemanda; la simultaneidad real de REBT opera a
// nivel Tablero/alimentador, no circuito). Ver el comentario completo
// en modules/motor/factorDemanda.js antes de reabrir este tema.
const CAMPOS_OBLIGATORIOS = [
  "id",
  "nombre",
  "familia",
  "unidadSeccion",
  "ordenSecciones",
  "areaMm2PorSeccion",
  "ampacidad",
  "reactanciaOhmKm",
  "breakersComerciales",
  "limiteCaidaTensionPct",
  "voltajesPorFase",
  "factorTemperatura",
  "reglasDemanda",
  "demandaPorDefecto",
  "validado",
  "notaValidacion",
];

function validarContrato(normativa) {
  const faltantes = CAMPOS_OBLIGATORIOS.filter((campo) => !(campo in normativa));
  if (faltantes.length > 0) {
    throw new Error(
      `Normativa "${normativa.id ?? "?"}" no cumple el contrato: faltan campos [${faltantes.join(", ")}].`
    );
  }
}

export const CATALOGO_NORMATIVAS = { NEC, CIEN, IEC_ES };

Object.values(CATALOGO_NORMATIVAS).forEach(validarContrato);

export const LISTA_NORMATIVAS = Object.values(CATALOGO_NORMATIVAS);

export function obtenerNormativaPorId(id) {
  return CATALOGO_NORMATIVAS[id] ?? CATALOGO_NORMATIVAS.NEC;
}
