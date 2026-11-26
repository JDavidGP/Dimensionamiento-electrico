// src/modules/plano/proteccionAFCI.ts
//
// Usuario, 2026-11-26: "sigamos con AFCI" — NEC 210.12(B) exige
// protección AFCI para los circuitos ramales de 120V/15-20A que
// alimentan ciertos ambientes de una vivienda. Cita de SECCIÓN
// confirmada por el usuario (misma tabla que dio 210.8 para GFCI, no
// texto literal del artículo): "Protección AFCI → 210.12(B)".
//
// A diferencia de GFCI (protege un RECEPTÁCULO), AFCI protege el
// CIRCUITO completo (210.12(B) habla de "circuitos ramales", no de
// tomacorrientes individuales) — por eso el checkbox vive en el
// Circuito, no en el Equipo (ver Circuito.proteccionAFCI), y la
// advertencia dispara si CUALQUIERA de los equipos del circuito cae en
// un ambiente de la lista (ver advertenciasAFCI en useCircuitos.js:
// recorre los equipos de cada circuito, no solo uno).
//
// Lista de ambientes de mi propio conocimiento de 210.12(B) (NEC
// 2020+: "dwelling unit kitchens, family rooms, dining rooms, living
// rooms, parlors, libraries, dens, bedrooms, sunrooms, recreation
// rooms, closets, hallways, laundry areas, or similar rooms or
// areas") — NO es una cita textual (el usuario solo confirmó el
// número de sección, no el texto completo), y la app no modela cada
// variante de "sala de estar/biblioteca/estudio/sunroom" por separado:
// se agrupan bajo "Sala" y "similares" por "cuarto similar", mismo
// criterio que el propio texto deja abierto ("or similar rooms or
// areas"). Cocina y Lavandería REUSAN los tipos de ambiente ya creados
// para GFCI (ediciones recientes del NEC exigen AMBOS en esos 2)
// — Baño/Garaje/Sótano sin terminar quedan afuera a propósito (no
// habitables / ya cubiertos solo por GFCI).

import { OPCIONES_TIPO_AMBIENTE, type TipoAmbiente } from "./tipoAmbiente.ts";

/** Ambientes que NEC 210.12(B) exige proteger con AFCI — ver nota de cabecera sobre la simplificación de nomenclatura. */
const TIPOS_AMBIENTE_AFCI = new Set<TipoAmbiente>(["dormitorio", "sala", "comedor", "pasillo", "closet", "cocina", "lavanderia"]);

export interface RequerimientoAFCI {
  requiere: boolean;
  /** Cita de sección (NEC 210.12(B)) — null si no requiere. Nunca un texto literal del artículo, ver nota de cabecera. */
  motivo: string | null;
}

/** ¿Un circuito que alimenta un equipo en este tipo de ambiente requiere protección AFCI? Exterior NUNCA dispara AFCI (es un requerimiento de ambientes interiores habitables, distinto de GFCI). */
export function requiereProteccionAFCI(tipoAmbiente: TipoAmbiente | null | undefined): RequerimientoAFCI {
  if (tipoAmbiente && TIPOS_AMBIENTE_AFCI.has(tipoAmbiente)) {
    const label = OPCIONES_TIPO_AMBIENTE.find((o) => o.valor === tipoAmbiente)?.label ?? tipoAmbiente;
    return { requiere: true, motivo: `NEC 210.12(B) — ${label.toLowerCase()}` };
  }
  return { requiere: false, motivo: null };
}
