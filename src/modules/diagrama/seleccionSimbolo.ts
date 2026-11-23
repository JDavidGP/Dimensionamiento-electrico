// src/modules/diagrama/seleccionSimbolo.ts
//
// Elige automáticamente qué símbolo del catálogo (ver
// shared/data/bibliotecaComponentes.js) representa mejor a un equipo,
// a partir de su nombre/función y tipoEquipoNEC — usado por el armado
// automático del diagrama tras importar (por PDF+IA o por texto, ver
// useCircuitos.js), para no dejar todo bajo "carga_especial" cuando
// el propio nombre ya dice de qué se trata. Puramente heurístico por
// palabras clave — nunca determina con certeza, por eso siempre cae
// a "carga_especial" (el símbolo ya existente para "no sé qué es
// exactamente, pero es una carga") en vez de adivinar mal.
//
// Módulo puro: strings adentro, string afuera. No sabe nada de React
// ni del resto del proyecto.

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // saca acentos (á→a, etc.) para no depender de cómo lo haya escrito el usuario/la IA
}

interface EquipoParaElegirSimbolo {
  nombre?: string;
  funcion?: string;
  tipoEquipoNEC?: string;
}

export function elegirSimboloEquipo(equipo: EquipoParaElegirSimbolo): string {
  const texto = normalizar(`${equipo.nombre ?? ""} ${equipo.funcion ?? ""}`);

  // Variantes de control de luminaria primero (más específico que
  // "es una luz" en general) — usuario, 2026-11-23.
  if (texto.includes("cascada")) return "luminaria_cascada";
  if (texto.includes("conmutad")) return "luminaria_conmutada"; // conmutado/conmutada/conmutador

  if (/\b(luz|luces|luminaria|lampara|bombillo|foco|reflector)\b/.test(texto)) return "luminaria";

  if (equipo.tipoEquipoNEC === "MOTOR" || /\bmotor\b/.test(texto)) return "motor";

  if (/\b(toma|tomacorriente|enchufe|receptaculo)\b/.test(texto)) return "contacto";

  return "carga_especial";
}
