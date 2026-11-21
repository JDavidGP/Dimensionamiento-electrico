// src/modules/diagrama/reglas.ts
//
// Motor de reglas eléctricas del diagrama unifilar — Fase 2 de la spec
// larga del usuario (2026-11-20), ahora que la Fase 1 (modelo de
// datos + cardinalidad) ya está construida. "Evita errores de diseño
// antes de que ocurran" / "Permite definir restricciones específicas
// para cada tipo de componente" — validación SEMÁNTICA de qué tipo de
// componente puede conectarse a cuál, más allá de la cardinalidad
// (que ya vive en index.js, validarConexion, y no se duplica acá).
//
// Tres niveles de regla, de más general a más específica (el más
// específico que aplique gana):
//   1. Matriz de categorías (FLUJO_PERMITIDO_POR_CATEGORIA) — el flujo
//      general de energía: fuente → protección/distribución →
//      [control] → carga. Es el caso por defecto.
//   2. Destinos EXCLUSIVOS por tipo (DESTINOS_EXCLUSIVOS_POR_TIPO) —
//      "X debe conectarse a Y" (más restrictivo que su categoría
//      general). Ejemplo citado por el usuario: un panel fotovoltaico
//      debe ir a un inversor o controlador, no a cualquier cosa de
//      categoría "fuente"-compatible.
//   3. Pares puntuales PROHIBIDOS (PARES_PROHIBIDOS) — "X no puede
//      conectarse directo a Y [sin Z]", aunque la categoría general lo
//      permitiría. Ejemplo citado: un motor no puede conectarse
//      directo a un medidor sin protección de por medio.
//
// "Un tomacorriente no puede alimentar un tablero" (otro ejemplo del
// usuario) NO necesita una regla acá — ya lo impide la cardinalidad de
// Fase 1: "contacto" tiene puntosConexion.salidas = 0 en el catálogo,
// así que nunca puede ser origen de ninguna conexión.
//
// FUERA DE ALCANCE A PROPÓSITO todavía: "las conexiones deben respetar
// las normas configuradas (IEC, NEC u otras)" — una matriz de reglas
// POR NORMATIVA necesitaría citas reales verificadas (mismo criterio
// de rigor que el resto de este proyecto con valores normativos), y
// no hay todavía un proyecto real que la necesite para validar el
// diseño contra casos reales. Lo que hay acá es una matriz GENÉRICA de
// buena práctica, no ligada a ninguna normativa en particular.
//
// CERO gráfico, cero UI. Módulo puro — se usa a través de index.js
// (validarConexion) y, por extensión, DiagramaMediator.

import { obtenerComponente } from "../../shared/data/bibliotecaComponentes.js";
import type { ResultadoValidacion } from "./tipos.ts";

// Categoría de origen → categorías de destino permitidas por defecto.
// "carga" no origina nada (ya reforzado por cardinalidad, salidas:0 en
// todos los tipos de esa categoría) — se deja explícito igual, para
// que quede documentado el porqué sin tener que ir a buscarlo.
export const FLUJO_PERMITIDO_POR_CATEGORIA: Record<string, string[]> = {
  fuente: ["medicion_proteccion", "distribucion"],
  medicion_proteccion: ["medicion_proteccion", "distribucion", "control", "carga"],
  distribucion: ["medicion_proteccion", "distribucion", "carga"],
  control: ["control", "carga", "medicion_proteccion"],
  carga: [],
};

// "X debe conectarse a Y" — si un tipo aparece acá, SUS destinos
// válidos son EXACTAMENTE esta lista, no la de su categoría general.
export const DESTINOS_EXCLUSIVOS_POR_TIPO: Record<string, string[]> = {
  // "Los paneles solares deben conectarse a un inversor o controlador
  // según el sistema" — "controlador" interpretado ampliamente como
  // variador de frecuencia o PLC, además del inversor explícito.
  panel_fotovoltaico: ["inversor", "variador_frecuencia", "plc"],
};

export interface ParProhibido {
  origen: string;
  destino: string;
  motivo: string;
}

// "X no puede conectarse directo a Y [sin Z de por medio]" — pares
// puntuales prohibidos aunque la categoría general los permitiría.
export const PARES_PROHIBIDOS: ParProhibido[] = [
  {
    origen: "medidor",
    destino: "motor",
    motivo:
      "Un motor no puede conectarse directamente a un medidor sin protección intermedia (ej. un interruptor termomagnético o un contactor).",
  },
];

/**
 * Valida si un tipo de componente ORIGEN puede conectarse a un tipo
 * DESTINO, según las reglas de arriba — NO valida cardinalidad (eso es
 * modules/diagrama/index.js, validarConexion) ni existencia de los
 * nodos (idem), solo compatibilidad semántica entre tipos.
 *
 * @param tipoOrigen - id del catálogo (ej. "medidor")
 */
export function validarReglaElectrica(tipoOrigen: string, tipoDestino: string): ResultadoValidacion {
  const compOrigen = obtenerComponente(tipoOrigen);
  const compDestino = obtenerComponente(tipoDestino);

  if (!compOrigen) return { valido: false, motivo: `Tipo de componente de origen desconocido (${tipoOrigen}).` };
  if (!compDestino) return { valido: false, motivo: `Tipo de componente de destino desconocido (${tipoDestino}).` };

  const prohibido = PARES_PROHIBIDOS.find((p) => p.origen === tipoOrigen && p.destino === tipoDestino);
  if (prohibido) {
    return { valido: false, motivo: prohibido.motivo };
  }

  const exclusivos = DESTINOS_EXCLUSIVOS_POR_TIPO[tipoOrigen];
  if (exclusivos) {
    if (!exclusivos.includes(tipoDestino)) {
      const nombresPermitidos = exclusivos.map((id) => obtenerComponente(id)?.nombre ?? id).join(", ");
      return { valido: false, motivo: `"${compOrigen.nombre}" solo puede conectarse a: ${nombresPermitidos}.` };
    }
    return { valido: true };
  }

  const categoriasPermitidas = FLUJO_PERMITIDO_POR_CATEGORIA[compOrigen.categoria] ?? [];
  if (!categoriasPermitidas.includes(compDestino.categoria)) {
    return {
      valido: false,
      motivo: `"${compOrigen.nombre}" (${compOrigen.categoria}) no puede conectarse a "${compDestino.nombre}" (${compDestino.categoria}) — ese flujo no es válido.`,
    };
  }

  return { valido: true };
}
