// src/modules/plano/proteccionGFCI.ts
//
// Usuario, 2026-11-25/26: "el tipo de tomacorriente incluso... el
// ambiente donde se localiza" — NEC 210.8(A) (unidades de vivienda) /
// 210.8(B) (no residencial) exige protección GFCI para los
// tomacorrientes de ciertos ambientes. Cita de SECCIÓN confirmada por
// el usuario (no texto literal del artículo, ver tabla que subió):
// "Protección GFCI (unidades de vivienda) → 210.8(A)" / "Protección
// GFCI (no residencial) → 210.8(B)".
//
// Clasifica por TIPO DE AMBIENTE completo ("cualquier tomacorriente en
// un ambiente tipo Cocina/Baño/..."), sin mirar distancia a un
// fregadero/bañera/mesón específico. Para Baño esto siempre fue exacto
// (210.8(A)(1) no tiene condición de distancia). Para Cocina, en NEC
// 2020 esto era una sobre-generalización A PROPÓSITO (210.8(A)(6)
// condicionaba a "sirve superficies de mesón" o "a 1.8m de un
// fregadero") — pero usuario, 2026-11-27, cita el texto vigente NEC
// 2023 210.8(A)(6): esa condición de distancia/mesón FUE ELIMINADA.
// Cita literal del encabezado 210.8(A): "All 125-volt through
// 250-volt receptacles installed in [Kitchens] ... supplied by
// single-phase branch circuits rated 150 volts or less to ground
// shall have ground-fault circuit-interrupter protection for
// personnel" — sin excepción por ubicación/distancia dentro de la
// cocina. Es decir: ya NO es una sobre-generalización, es el criterio
// EXACTO de la edición vigente (igual de exacto que Baño). Sigue sin
// modelar geometría de artefactos (fregadero/mesón) porque ya no hace
// falta para Cocina — y para Baño nunca hizo falta.

import { OPCIONES_TIPO_AMBIENTE, type TipoAmbiente } from "./tipoAmbiente.ts";
export type { TipoAmbiente };
export { OPCIONES_TIPO_AMBIENTE };

/** Tipos de ambiente (además de `exterior`, ya un campo propio) que NEC 210.8(A)/(B) exige proteger con GFCI. */
const TIPOS_AMBIENTE_GFCI = new Set<TipoAmbiente>(["bano", "cocina", "garage", "lavanderia", "sotano_sin_terminar"]);

export interface RequerimientoGFCI {
  requiere: boolean;
  /** Cita de sección (NEC 210.8(A) o (B) según tipoInstalacion) — null si no requiere. Nunca un texto literal del artículo, ver nota de cabecera. */
  motivo: string | null;
}

/**
 * ¿El tomacorriente de un ambiente con este tipo (y/o marcado
 * exterior) requiere protección GFCI? `tipoInstalacion` decide si cita
 * 210.8(A) (vivienda) o 210.8(B) (no residencial) — mismo criterio que
 * TIPOS_INSTALACION ya usa el resto de la app, ver shared/constants/constantes.js.
 */
export function requiereProteccionGFCI(tipoAmbiente: TipoAmbiente | null | undefined, exterior: boolean, esResidencial: boolean): RequerimientoGFCI {
  const seccion = esResidencial ? "NEC 210.8(A)" : "NEC 210.8(B)";
  if (exterior) {
    return { requiere: true, motivo: `${seccion} — exteriores` };
  }
  if (tipoAmbiente && TIPOS_AMBIENTE_GFCI.has(tipoAmbiente)) {
    const label = OPCIONES_TIPO_AMBIENTE.find((o) => o.valor === tipoAmbiente)?.label ?? tipoAmbiente;
    return { requiere: true, motivo: `${seccion} — ${label.toLowerCase()}` };
  }
  return { requiere: false, motivo: null };
}
