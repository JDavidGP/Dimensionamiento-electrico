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
// SIMPLIFICACIÓN DELIBERADA: clasifica por TIPO DE AMBIENTE completo,
// no por distancia a un fregadero/bañera/mesón específico (210.8(A)(6)
// en cocina es, en el texto real, condicionado a "sirve superficies de
// mesón" o "a 1.8m de un fregadero" — acá se simplifica a "cualquier
// tomacorriente en un ambiente tipo Cocina"). Para Baño esto es exacto
// (210.8(A)(1) no tiene condición de distancia); para Cocina es una
// sobre-generalización A PROPÓSITO, conservadora (avisa de más en
// seguridad, nunca de menos) — modelar la posición real de un
// fregadero/mesón es un alcance mucho más grande (geometría de
// artefactos dentro del ambiente), no esta ronda.

export type TipoAmbiente = "bano" | "cocina" | "garage" | "lavanderia" | "sotano_sin_terminar" | "otro";

export const OPCIONES_TIPO_AMBIENTE: { valor: TipoAmbiente; label: string }[] = [
  { valor: "otro", label: "Otro" },
  { valor: "bano", label: "Baño" },
  { valor: "cocina", label: "Cocina" },
  { valor: "garage", label: "Garaje" },
  { valor: "lavanderia", label: "Lavandería" },
  { valor: "sotano_sin_terminar", label: "Sótano sin terminar" },
];

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
