// src/modules/importacionEquipos/index.ts
//
// Dominio: interpretar un bloque de texto escrito a mano en una lista
// de "comandos de creación de equipo", agrupados bajo la etiqueta de
// un circuito YA EXISTENTE — pedido explícito del usuario (2026-11-20),
// tras evaluar (y descartar JUNTO AL USUARIO) un chatbot con IA real
// para esto: mismo resultado útil, determinístico, sin mandar nada a
// ningún servidor y sin la ambigüedad de interpretar texto libre.
//
// REGLA DE ORO, pedida explícitamente: esto NUNCA crea tableros ni
// circuitos nuevos, ni inventa un dato que el texto no haya dado — un
// circuito se referencia por su etiqueta YA EXISTENTE (mismo sistema
// de etiquetado ya construido, ver modules/etiquetado/), nunca se crea
// "al vuelo". La resolución contra los circuitos reales del proyecto
// (y la validación/fábrica final del equipo) vive en
// ImportacionMediator — acá es SOLO texto → estructura intermedia,
// cero conocimiento del resto del proyecto (módulo puro).
//
// NO es un camino de CÁLCULO distinto ni "inverso": el equipo que
// resulta de un comando bien formado pasa por la MISMA validación y
// fábrica que ya usa el formulario manual (ver ImportacionMediator)
// — para el motor de cálculo, un equipo importado por texto es
// indistinguible de uno tipeado a mano.
//
// Formato (una etiqueta de circuito encabeza un bloque; cada línea
// siguiente es "<cantidad> <nombre> <valor><W|A>"):
//
//   TD1-C3
//   5 Bombillo 40W
//   35 Bombillo 20W
//
//   TD1-C4
//   1 Refrigerador 1200W
//
// Deliberadamente SIN soporte (en esta ronda) para especificar cosPhi
// o tipo de equipo NEC por texto — toman el default seguro del
// formulario (factor de potencia 1.0, "Carga general"), editable
// después a mano como cualquier equipo. Mantener la sintaxis mínima
// es a propósito: menos formas de escribir algo ambiguo.

const PATRON_LINEA_EQUIPO = /^(\d+)\s+(.+?)\s+(\d+(?:\.\d+)?)\s*(W|A)$/i;

export interface LineaEquipoInterpretada {
  numeroLinea: number;
  ok: true;
  etiquetaCircuito: string;
  nombre: string;
  cantidad: string;
  valor: string;
  modoEntrada: "potencia" | "corriente";
}

export interface LineaEquipoInvalida {
  numeroLinea: number;
  ok: false;
  motivo: string;
}

export type LineaInterpretada = LineaEquipoInterpretada | LineaEquipoInvalida;

export function interpretarTexto(texto: string): LineaInterpretada[] {
  const lineas = (texto || "").split("\n");
  const resultados: LineaInterpretada[] = [];
  let etiquetaActual: string | null = null;

  lineas.forEach((lineaCruda, indice) => {
    const linea = lineaCruda.trim();
    if (!linea) return; // líneas en blanco separan bloques, se ignoran
    const numeroLinea = indice + 1;
    const match = linea.match(PATRON_LINEA_EQUIPO);

    if (match) {
      if (!etiquetaActual) {
        resultados.push({
          numeroLinea,
          ok: false,
          motivo: `"${linea}" — falta indicar antes a qué circuito pertenece (una línea con su etiqueta, ej. "TD1-C3").`,
        });
        return;
      }
      const [, cantidad, nombre, valor, unidad] = match;
      resultados.push({
        numeroLinea,
        ok: true,
        etiquetaCircuito: etiquetaActual,
        nombre: nombre.trim(),
        cantidad,
        valor,
        modoEntrada: unidad.toUpperCase() === "A" ? "corriente" : "potencia",
      });
      return;
    }

    // No tiene forma de línea de equipo ("cantidad nombre valorW/A")
    // → es un encabezado: la etiqueta del circuito al que van a
    // pertenecer las líneas de equipo que sigan, hasta el próximo
    // encabezado (o el final del texto).
    etiquetaActual = linea;
  });

  return resultados;
}
