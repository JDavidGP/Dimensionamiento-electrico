// src/modules/normativa/cien.ts
//
// CIEN (Nicaragua) es una normativa DERIVADA de NEC: el propio Código de
// Instalaciones Eléctricas de Nicaragua adopta la misma estructura y
// numeración de artículos que el NEC (Arts. 100-250), remite a su propia
// "Sección 310-15" para ampacidad, y su Art. 240-6 lista los mismos
// tamaños de breaker (15-200A) palabra por palabra.
//
// Por eso CIEN hereda TODAS las tablas y reglas de NEC por referencia
// (mismo objeto, no una copia) — si se corrige un valor en nec.js, CIEN
// lo recibe automáticamente. Solo se declara acá lo que le pertenece a su
// propia identidad. El día que Nicaragua emita una enmienda propia a un
// artículo específico, ese campo se sobrescribe acá sin tocar NEC.

import { NEC } from "./nec.ts";
import type { Normativa } from "./tipos.ts";

export const CIEN: Normativa = {
  ...NEC,
  id: "CIEN",
  nombre: "CIEN (Nicaragua)",
  familia: "CIEN",
  notaValidacion:
    "Verificado contra el texto oficial del Código de Instalaciones Eléctricas de Nicaragua: adopta la misma estructura y numeración de artículos que el NEC (Arts. 100-250), remite explícitamente a su propia 'Sección 310-15' para ampacidad, y su Artículo 240-6 lista los mismos tamaños de breaker (15-200A) que NEC, palabra por palabra.",
};
