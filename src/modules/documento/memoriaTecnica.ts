// Módulo Documento — memoria técnica / informe. CERO gráfico, cero PDF:
// solo arma un modelo de datos plano a partir de lo YA calculado
// (circuitos/equipos/resultados/tableros/alimentadores/listaIntegridad)
// — mismo criterio que el resto de la app ("Documento consume
// resultados ya calculados, nunca llama al Motor directamente", ver
// ARCHITECTURE.md §11). La UI (componente InformeTecnico.jsx) es quien
// decide cómo mostrarlo/imprimirlo — este módulo no sabe que existe un
// navegador.
//
// `origenPorTablero` y `normativa`/`tipoInstalacion` (ya resueltos a
// {id, nombre} / {id, label}) los arma DocumentoMediator ANTES de
// llamar acá — resolver un origen cruza hacia el dominio Origen
// (tableros/fuentesEnergia/transformadores), y un módulo puro no debe
// cruzar hacia otro dominio (esa regla sí es del mediador, no de este
// módulo).

import type {
  Circuito,
  Equipo,
  Tablero,
  ResultadoCircuito,
  AlimentadorResultado,
  DatosMemoriaTecnica,
  FilaCircuito,
  FilaTablero,
  MemoriaTecnica,
  ResumenMaterialCalibre,
} from "./tipos.ts";

/** Número válido (no NaN, no vacío) o null — nunca inventa un 0 para un dato que no vino. */
function numeroOnull(valor: unknown): number | null {
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/** Una fila de la tabla de circuitos del informe. */
function filaCircuito(circuito: Circuito, equipos: Equipo[], resultados: ResultadoCircuito[]): FilaCircuito {
  const r = resultados.find((res) => res.id === circuito.id) ?? null;
  return {
    id: circuito.id,
    nombre: circuito.nombre?.trim() || "(sin nombre)",
    tipo: circuito.tipo,
    fases: circuito.fases,
    voltaje: circuito.voltaje,
    material: circuito.material,
    cantidadEquipos: equipos.filter((e) => e.circuitoId === circuito.id).length,
    ok: r?.ok ?? false,
    potenciaW: r?.ok ? r.cargaDemandaNormativaW : null,
    corrienteA: r?.ok ? r.corrienteDiseno : null,
    seccion: r?.ok ? r.seccion : null,
    unidadSeccion: r?.ok ? r.unidadSeccion : null,
    breaker: r?.ok ? r.breaker : null,
    caidaPct: r?.ok ? r.caidaPct : null,
    distanciaM: numeroOnull(circuito.distancia),
    advertencias: r?.ok ? r.advertencias ?? [] : [],
    error: r && !r.ok ? r.error : r ? null : "Sin calcular todavía.",
  };
}

/** Una fila de la tabla de tableros del informe. */
function filaTablero(tablero: Tablero, alimentadores: Record<string, AlimentadorResultado>, origenPorTablero: Record<string, string>): FilaTablero {
  const alim = tablero.id ? alimentadores[tablero.id] : undefined;
  return {
    id: tablero.id,
    nombre: tablero.nombre?.trim() || "(sin nombre)",
    tensionAlimentacion: tablero.tensionAlimentacion,
    fases: tablero.fases,
    origen: (tablero.id && origenPorTablero[tablero.id]) ?? "Red eléctrica local (acometida / poste)",
    ok: alim?.ok ?? false,
    potenciaW: alim?.ok ? alim.potenciaTotalW ?? null : null,
    corrienteA: alim?.ok ? alim.corrienteDiseno ?? null : null,
    seccion: alim?.ok ? alim.seccion ?? null : null,
    unidadSeccion: alim?.ok ? alim.unidadSeccion ?? null : null,
    breaker: alim?.ok ? alim.breaker ?? null : null,
    caidaPct: alim?.ok ? alim.caidaPct ?? null : null,
    distanciaM: numeroOnull(tablero.longitudAlimentador),
    simultaneidadREBT: alim?.ok ? alim.simultaneidadREBT ?? null : null,
    motivo: alim && !alim.ok ? alim.motivo ?? alim.error ?? "Alimentador sin calcular." : null,
  };
}

// "El extra de cruce de pared → conectarlo al cálculo de materiales"
// (usuario, 2026-11-26, último punto de su orden de prioridad — hasta
// esta ronda el extra de cruce (modules/plano/cruceParedes.ts) era
// puramente informativo en la tarjeta de la ruta del Plano, nunca se
// sumaba a ningún presupuesto). Alcance elegido explícitamente por el
// usuario: un resumen de METROS LINEALES por calibre (sin unidades de
// compra — rollos/tubos — que varían por ferretería/práctica local, no
// modeladas a propósito). Suma `distanciaM` (circuito.distancia /
// tablero.longitudAlimentador) de cada fila OK con calibre conocido —
// el MISMO campo que "Usar esta longitud" del Plano ya sincroniza, así
// que el extra de cruce de pared YA está incluido en el total para
// cualquier circuito/tablero cuya ruta se haya sincronizado así; para
// uno cargado a mano sin pasar por el Plano, es la distancia que el
// propio usuario anotó — nunca se inventa un número aparte.
export function resumenMaterialesPorCalibre(circuitos: FilaCircuito[], tableros: FilaTablero[]): ResumenMaterialCalibre[] {
  const acumulado = new Map<string, ResumenMaterialCalibre>();
  function sumar(seccion: string | null, unidadSeccion: string | null, distanciaM: number | null) {
    if (!seccion || !unidadSeccion || distanciaM == null || !(distanciaM > 0)) return;
    const clave = `${seccion}|${unidadSeccion}`;
    const actual = acumulado.get(clave) ?? { seccion, unidadSeccion, metrosTotal: 0 };
    actual.metrosTotal += distanciaM;
    acumulado.set(clave, actual);
  }
  for (const c of circuitos) if (c.ok) sumar(c.seccion, c.unidadSeccion, c.distanciaM);
  for (const t of tableros) if (t.ok) sumar(t.seccion, t.unidadSeccion, t.distanciaM);
  return [...acumulado.values()].sort((a, b) => b.metrosTotal - a.metrosTotal);
}

/**
 * @param datos.normativa - ya resuelta
 * @param datos.tipoInstalacion - ya resuelto, puede faltar en proyectos viejos
 * @param datos.alimentadores - mapa tableroId -> resultado de calcularAlimentadorAgregado (YA calculado)
 * @param datos.origenPorTablero - mapa tableroId -> etiqueta legible de su origen (YA resuelta)
 */
export function generarMemoriaTecnica({
  proyecto,
  normativa,
  tipoInstalacion = null,
  circuitos = [],
  equipos = [],
  resultados = [],
  tableros = [],
  alimentadores = {},
  origenPorTablero = {},
  fuentesEnergia = [],
  transformadores = [],
  listaIntegridad = [],
}: DatosMemoriaTecnica): MemoriaTecnica {
  const filasCircuitos = circuitos.map((c) => filaCircuito(c, equipos, resultados));
  const filasTableros = tableros.map((t) => filaTablero(t, alimentadores, origenPorTablero));

  const totales = filasCircuitos.reduce(
    (acc, f) => {
      if (f.ok) {
        acc.potenciaTotalW += f.potenciaW ?? 0;
        acc.corrienteTotalA += f.corrienteA ?? 0;
        acc.circuitosOk += 1;
      }
      return acc;
    },
    { potenciaTotalW: 0, corrienteTotalA: 0, circuitosOk: 0, circuitosTotal: filasCircuitos.length }
  );

  const entradasConProblemas = listaIntegridad.filter((e) => e.problemas && e.problemas.length > 0);
  const resumenIntegridad = listaIntegridad.reduce<Record<string, number>>(
    (acc, e) => {
      acc[e.estado] = (acc[e.estado] ?? 0) + 1;
      return acc;
    },
    { ok: 0, advertencia: 0, error: 0 }
  );

  return {
    proyecto: proyecto ?? { nombre: "Proyecto sin nombre" },
    fechaGeneracion: new Date().toISOString(),
    normativa: normativa ?? { id: "", nombre: "Sin normativa" },
    tipoInstalacion,
    circuitos: filasCircuitos,
    totales,
    tableros: filasTableros,
    fuentesEnergia,
    transformadores,
    integridad: { resumen: resumenIntegridad, entradas: entradasConProblemas },
    materiales: resumenMaterialesPorCalibre(filasCircuitos, filasTableros),
  };
}
