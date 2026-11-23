// src/modules/iaLocal/esquema.ts
//
// Valida/sanea el JSON que devolvió la IA local ANTES de mostrarlo en
// la vista previa — nunca se confía en que el modelo respetó la forma
// pedida (ver ollamaClient.ts: un modelo chico puede devolver JSON
// sintácticamente válido pero con campos de más/menos, tipos raros, o
// números fuera de todo rango físico posible). Acá solo se descarta
// basura obvia; la validación REAL y completa de un circuito/tablero
// (la misma que usa el formulario manual) pasa recién al confirmar la
// importación — ver ImportarProyectoPDFMediator / useCircuitos.js.
//
// Módulo puro: no conoce React, no conoce Ollama, no conoce el resto
// del proyecto DEC — solo sabe interpretar esta forma intermedia.

export type Fases = "mono" | "bi" | "tri" | null;

export interface CircuitoExtraido {
  descripcion: string;
  potencia_w: number | null;
  corriente_a: number | null;
  voltaje_v: number | null;
  fases: Fases;
}

export interface TableroExtraido {
  nombre: string;
  tension_v: number | null;
  fases: Fases;
  // Longitud de la derivación individual / alimentador (CPM/acometida
  // → este tablero) — usuario, 2026-11-23: varios documentos la dan
  // explícita (ej. REBT "longitud de derivación individual de 18
  // metros"), no hay razón para dejarla en blanco si el texto la trae.
  longitud_alimentador_m: number | null;
  circuitos: CircuitoExtraido[];
}

export interface ResultadoValidacion {
  tableros: TableroExtraido[];
  avisos: string[];
}

// Rangos físicamente plausibles para una instalación eléctrica común —
// cualquier cosa fuera de esto se descarta como ruido del modelo, no
// se "recorta" al límite (recortar inventaría un valor que el
// documento no dio).
const VOLTAJE_MIN = 1;
const VOLTAJE_MAX = 50000; // cubre hasta media tensión, por si acaso
const CORRIENTE_MIN = 0.01;
const CORRIENTE_MAX = 10000;
const POTENCIA_MIN = 1;
const POTENCIA_MAX = 1000000; // 1 MW — cubre de sobra residencial/comercial chico
const LONGITUD_MIN = 0; // 0 válido: tablero pegado directo a la fuente
const LONGITUD_MAX = 10000; // 10 km — generoso, nunca recorta un valor real

function numeroONull(valor: unknown, min: number, max: number): number | null {
  if (valor === null || valor === undefined) return null;
  const n = typeof valor === "number" ? valor : parseFloat(String(valor));
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

function fasesONull(valor: unknown): Fases {
  return valor === "mono" || valor === "bi" || valor === "tri" ? valor : null;
}

function textoONull(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * Convierte el JSON crudo de la IA en una forma saneada y segura de
 * recorrer. Nunca lanza — ante CUALQUIER forma inesperada (no es un
 * objeto, "tableros" no es un array, etc.) devuelve tableros: [] con
 * un aviso, para que la UI muestre "no se reconoció nada" en vez de
 * romper.
 */
export function validarExtraccion(crudo: unknown): ResultadoValidacion {
  const avisos: string[] = [];

  if (typeof crudo !== "object" || crudo === null || !Array.isArray((crudo as { tableros?: unknown }).tableros)) {
    return { tableros: [], avisos: ["La IA no devolvió la forma esperada (sin lista de tableros) — probá de nuevo."] };
  }

  const tablerosCrudos = (crudo as { tableros: unknown[] }).tableros;
  const tableros: TableroExtraido[] = [];

  tablerosCrudos.forEach((tCrudo, i) => {
    if (typeof tCrudo !== "object" || tCrudo === null) {
      avisos.push(`Tablero #${i + 1}: forma inválida, se descartó.`);
      return;
    }
    const t = tCrudo as Record<string, unknown>;
    const nombre = textoONull(t.nombre) || `Tablero ${i + 1}`;
    const circuitosCrudos = Array.isArray(t.circuitos) ? t.circuitos : [];

    const circuitos: CircuitoExtraido[] = [];
    circuitosCrudos.forEach((cCrudo, j) => {
      if (typeof cCrudo !== "object" || cCrudo === null) {
        avisos.push(`"${nombre}", circuito #${j + 1}: forma inválida, se descartó.`);
        return;
      }
      const c = cCrudo as Record<string, unknown>;
      circuitos.push({
        descripcion: textoONull(c.descripcion) || `Circuito ${j + 1}`,
        potencia_w: numeroONull(c.potencia_w, POTENCIA_MIN, POTENCIA_MAX),
        corriente_a: numeroONull(c.corriente_a, CORRIENTE_MIN, CORRIENTE_MAX),
        voltaje_v: numeroONull(c.voltaje_v, VOLTAJE_MIN, VOLTAJE_MAX),
        fases: fasesONull(c.fases),
      });
    });

    tableros.push({
      nombre,
      tension_v: numeroONull(t.tension_v, VOLTAJE_MIN, VOLTAJE_MAX),
      fases: fasesONull(t.fases),
      longitud_alimentador_m: numeroONull(t.longitud_alimentador_m, LONGITUD_MIN, LONGITUD_MAX),
      circuitos,
    });
  });

  if (tableros.length === 0) {
    avisos.push("No se reconoció ningún tablero en el documento.");
  }

  return { tableros, avisos };
}
