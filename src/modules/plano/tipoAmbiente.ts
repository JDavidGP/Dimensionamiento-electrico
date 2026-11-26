// src/modules/plano/tipoAmbiente.ts
//
// Vocabulario de "función del ambiente" — compartido entre
// proteccionGFCI.ts (NEC 210.8) y proteccionAFCI.ts (NEC 210.12),
// ambos clasifican por este mismo campo (`HabitacionPlano.tipoAmbiente`).
// Vive en su propio archivo (no dentro de proteccionGFCI.ts, donde
// nació) para que ninguno de los dos módulos de protección dependa del
// otro.

export type TipoAmbiente =
  | "bano"
  | "cocina"
  | "garage"
  | "lavanderia"
  | "sotano_sin_terminar"
  | "dormitorio"
  | "sala"
  | "comedor"
  | "pasillo"
  | "closet"
  | "otro";

export const OPCIONES_TIPO_AMBIENTE: { valor: TipoAmbiente; label: string }[] = [
  { valor: "otro", label: "Otro" },
  { valor: "bano", label: "Baño" },
  { valor: "cocina", label: "Cocina" },
  { valor: "garage", label: "Garaje" },
  { valor: "lavanderia", label: "Lavandería" },
  { valor: "sotano_sin_terminar", label: "Sótano sin terminar" },
  { valor: "dormitorio", label: "Dormitorio" },
  { valor: "sala", label: "Sala" },
  { valor: "comedor", label: "Comedor" },
  { valor: "pasillo", label: "Pasillo" },
  { valor: "closet", label: "Clóset" },
];
