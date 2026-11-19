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

/** Una fila de la tabla de circuitos del informe. */
function filaCircuito(circuito, equipos, resultados) {
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
    advertencias: r?.ok ? r.advertencias ?? [] : [],
    error: r && !r.ok ? r.error : r ? null : "Sin calcular todavía.",
  };
}

/** Una fila de la tabla de tableros del informe. */
function filaTablero(tablero, alimentadores, origenPorTablero) {
  const alim = alimentadores[tablero.id];
  return {
    id: tablero.id,
    nombre: tablero.nombre?.trim() || "(sin nombre)",
    tensionAlimentacion: tablero.tensionAlimentacion,
    fases: tablero.fases,
    origen: origenPorTablero[tablero.id] ?? "Red eléctrica local (acometida / poste)",
    ok: alim?.ok ?? false,
    potenciaW: alim?.ok ? alim.potenciaTotalW : null,
    corrienteA: alim?.ok ? alim.corrienteDiseno : null,
    seccion: alim?.ok ? alim.seccion : null,
    unidadSeccion: alim?.ok ? alim.unidadSeccion : null,
    breaker: alim?.ok ? alim.breaker : null,
    caidaPct: alim?.ok ? alim.caidaPct : null,
    simultaneidadREBT: alim?.ok ? alim.simultaneidadREBT ?? null : null,
    motivo: alim && !alim.ok ? alim.motivo ?? alim.error ?? "Alimentador sin calcular." : null,
  };
}

/**
 * @param {object} datos
 * @param {object} datos.proyecto
 * @param {{id:string, nombre:string}} datos.normativa - ya resuelta
 * @param {{id:string, label:string}} [datos.tipoInstalacion] - ya resuelto, puede faltar en proyectos viejos
 * @param {object[]} datos.circuitos
 * @param {object[]} datos.equipos
 * @param {object[]} datos.resultados
 * @param {object[]} datos.tableros
 * @param {object} datos.alimentadores - mapa tableroId -> resultado de calcularAlimentadorAgregado (YA calculado)
 * @param {object} datos.origenPorTablero - mapa tableroId -> etiqueta legible de su origen (YA resuelta)
 * @param {object[]} [datos.fuentesEnergia]
 * @param {object[]} [datos.transformadores]
 * @param {object[]} [datos.listaIntegridad]
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
}) {
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

  const entradasConProblemas = listaIntegridad.filter((e) => e.problemas?.length > 0);
  const resumenIntegridad = listaIntegridad.reduce(
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
  };
}
