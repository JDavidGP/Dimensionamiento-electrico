/**
 * Hook de estado de la UI.
 * Toda interacción entre dominios pasa por ApplicationMediator
 * (no importa motor, normativa ni validación directamente).
 */
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { ApplicationMediator as App } from "../core/ApplicationMediator.js";
import { TIPO_INSTALACION_POR_DEFECTO, TIPOS_INSTALACION } from "../shared/constants/constantes.js";
import { renderizarPrimeraPaginaPDF, esArchivoPDF } from "../shared/utils/pdfARaster.ts";
import { rectificarImagen } from "../shared/utils/rectificarImagen.ts";

const { CIRCUITO_VACIO, EQUIPO_VACIO, TABLERO_VACIO } = App.data.tablas.plantillas();

export function useCircuitos() {
  const [proyecto, setProyecto] = useState(() => App.nuevoProyecto());
  const [avisoArchivo, setAvisoArchivo] = useState("");
  const [circuitos, setCircuitos] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [tableros, setTableros] = useState([]);
  const [fuentesEnergia, setFuentesEnergia] = useState([]);
  const [transformadores, setTransformadores] = useState([]);
  // Diferencial (ID) — REBT ITC-BT-25, agrupa hasta MAX_CIRCUITOS_POR_DIFERENCIAL
  // circuitos (ver modules/diferencial/index.ts). Mismo patrón exacto
  // que transformadores/fuentesEnergia: array plano propio, el circuito
  // guarda `diferencialId` (FK opcional).
  const [diferenciales, setDiferenciales] = useState([]);
  const [nodosDiagrama, setNodosDiagrama] = useState([]);
  const [conexionesDiagrama, setConexionesDiagrama] = useState([]);
  // --- Plano inteligente (Fase 1, 2026-11-20) — ver
  // PLANO_INTELIGENTE_DISENO.md. `planoImagen`/`planoCalibracion` son
  // metadatos del archivo cargado y del escalar metros/píxel;
  // `nodosPlano`/`segmentosPlano` son el grafo de paredes YA en
  // espacio modelo (metros); `habitacionesPlano` son polígonos
  // cerrados derivados (área/perímetro ya calculados, nunca se tocan
  // a mano). El `transformVista` (zoom/pan) NO vive acá — es estado
  // efímero de PlanoInteligente.jsx, nunca se persiste como parte del
  // cálculo (ver el diseño, §1 y §4).
  const [planoImagen, setPlanoImagen] = useState(null);
  const [planoCalibracion, setPlanoCalibracion] = useState(null);
  // Altura de techo general del plano (piso a viga corona/encofrado),
  // en metros — usuario, 2026-11-25: dato real distinto del ancho/largo
  // en planta, útil para el tramo vertical del conductor hacia tomas e
  // interruptores (ese cálculo en sí todavía no existe, esto es solo la
  // captura del dato). null = no capturada todavía. Cada ambiente puede
  // override-ar esto con su propio HabitacionPlano.alturaM si necesita
  // una altura distinta (ver editarAlturaHabitacionPlano).
  const [alturaTechoPlanoM, setAlturaTechoPlanoM] = useState(null);
  const [nodosPlano, setNodosPlano] = useState([]);
  const [segmentosPlano, setSegmentosPlano] = useState([]);
  const [habitacionesPlano, setHabitacionesPlano] = useState([]);
  // --- Rutas de conductor + equipos en el plano (2026-11-20) — ver nota
  // de arquitectura en modules/plano/index.js. `rutasConductorPlano`
  // reusa el MISMO grafo nodosPlano/segmentosPlano (los tramos de ruta
  // se crean como segmentos con tipo "conductor"), solo agrupa qué
  // nodos forman cada ruta + su longitud ya calculada.
  // `marcadoresEquipoPlano` son puntos independientes del grafo (no son
  // nodos ni paredes) — mismo catálogo de tipos que el diagrama
  // unifilar (ver PlanoMediator.CATALOGO_COMPONENTES).
  const [rutasConductorPlano, setRutasConductorPlano] = useState([]);
  const [marcadoresEquipoPlano, setMarcadoresEquipoPlano] = useState([]);
  const [normativaActiva, setNormativaActivaBase] = useState(
    App.config.normativaPorDefecto
  );
  // Tipo de instalación (domiciliaria/industrial) — elegido junto con
  // la normativa (ver SelectorNormativa.jsx). Por ahora es puramente
  // informativo: no filtra ni agrega equipos/tablas todavía — ver la
  // nota de investigación NEC/REBT en shared/constants/constantes.js.
  const [tipoInstalacion, setTipoInstalacion] = useState(TIPO_INSTALACION_POR_DEFECTO);

  // Umbral de desbalance de fases — vive como estado de React (no solo
  // en Config) para que cambiarlo desde Ajustes dispare un re-render.
  // Arranca igual al default de Config; al cambiarlo, también se
  // actualiza Config.limites para quien lo lea fuera de este hook.
  const [umbralDesbalanceFasesPct, setUmbralDesbalanceFasesPctBase] = useState(
    App.config.limites.desbalanceFasesPct
  );
  function setUmbralDesbalanceFasesPct(valor) {
    const num = Number(valor);
    if (!(num > 0)) return; // ignora valores inválidos, no rompe el estado
    setUmbralDesbalanceFasesPctBase(num);
    App.config.set({ limites: { desbalanceFasesPct: num } });
  }

  // Lazy initializer (función, no valor) — mismo criterio que
  // `proyecto` arriba: solo se evalúa en el primer render, no en cada
  // re-render. Acá circuitos/equipos todavía están vacíos ([]), así
  // que la primera sugerencia siempre es "C1"/"E1" — correcto, pero
  // calculado vía el mediador (no hardcodeado) para no duplicar la
  // lógica de modules/etiquetado/index.js.
  const [formCircuito, setFormCircuito] = useState(() => ({ ...CIRCUITO_VACIO, etiqueta: App.etiquetado.sugerirCircuito(null, []) }));
  const [errorCircuito, setErrorCircuito] = useState("");
  const [editandoCircuitoId, setEditandoCircuitoId] = useState(null);
  const [circuitoActivoId, setCircuitoActivoId] = useState(null);

  const [formEquipo, setFormEquipo] = useState(() => ({ ...EQUIPO_VACIO, etiqueta: App.etiquetado.sugerirEquipo(null, []) }));
  const [errorEquipo, setErrorEquipo] = useState("");
  const [editandoEquipoId, setEditandoEquipoId] = useState(null);

  // Usuario, 2026-11-21 (REBT ITC-BT-19 §2.2.2): contexto de
  // instalación por circuito — tipoInstalacion + si la cadena de
  // tableros de ese circuito termina en un transformador propio (ver
  // TableroMediator.tieneTransformadorPropio). Solo lo usa IEC_ES para
  // el límite de caída de tensión; NEC/CIEN lo ignoran por su cuenta
  // (ver Normativa.limiteCaidaTensionTramoPct, undefined para ellas).
  const contextoPorCircuitoId = useMemo(() => {
    const mapa = {};
    circuitos.forEach((c) => {
      mapa[c.id] = {
        tipoInstalacion,
        tieneTransformadorPropio: c.tableroId
          ? App.tablero.tieneTransformadorPropio(c.tableroId, { tableros, fuentesEnergia, transformadores })
          : false,
      };
    });
    return mapa;
  }, [circuitos, tableros, fuentesEnergia, transformadores, tipoInstalacion]);

  // Cálculo vía MotorCalculoMediator
  const resultados = useMemo(
    () => App.motor.calcularTodos(circuitos, equipos, normativaActiva, contextoPorCircuitoId),
    [circuitos, equipos, normativaActiva, contextoPorCircuitoId]
  );

  // Mantener DataProvider sincronizado (para mediadores que lean snapshot)
  useEffect(() => {
    App.syncSnapshot({
      proyecto,
      circuitos,
      equipos,
      tableros,
      fuentesEnergia,
      transformadores,
      diferenciales,
      nodosDiagrama,
      conexionesDiagrama,
      normativaActiva,
      tipoInstalacion,
      resultados,
    });
  }, [proyecto, circuitos, equipos, tableros, fuentesEnergia, transformadores, diferenciales, nodosDiagrama, conexionesDiagrama, normativaActiva, tipoInstalacion, resultados]);

  const totales = useMemo(() => {
    const potenciaTotal = resultados.reduce(
      (s, r) => s + (r.ok ? r.cargaDemandaNormativaW ?? r.potenciaTotal ?? 0 : 0),
      0
    );
    const potenciaConectada = resultados.reduce(
      (s, r) => s + (r.cargaConectadaW ?? (r.ok ? r.potenciaTotal : 0) ?? 0),
      0
    );
    const corrienteTotal = resultados.reduce(
      (s, r) => s + (r.ok ? r.corrienteDiseno ?? r.corriente : 0),
      0
    );
    return { potenciaTotal, potenciaConectada, corrienteTotal };
  }, [resultados]);

  // Alimentador de cada tablero, vía TableroMediator — AGREGADO: incluye
  // la demanda de todo su subárbol (sus circuitos propios + la de cada
  // tablero hijo, recursivo), no solo sus circuitos directos. Antes de
  // esto, un tablero padre sin circuitos propios (el caso normal de un
  // panel principal que solo alimenta subpaneles) quedaba "pendiente"
  // para siempre y su calibre/breaker nunca se veía — no dispara el
  // motor en cadena: usa los `resultados` de circuitos ya calculados.
  const alimentadores = useMemo(() => {
    const mapa = {};
    tableros.forEach((t) => {
      mapa[t.id] = App.tablero.calcularAlimentadorAgregado(t.id, {
        tableros,
        circuitos,
        resultados,
        normativaId: normativaActiva,
        fuentesEnergia,
      });
    });
    return mapa;
  }, [tableros, circuitos, resultados, normativaActiva, fuentesEnergia]);

  // Chequeo ADICIONAL de caída de tensión acumulada, recorriendo la
  // cadena de tableros hacia arriba (tableroPadreId). Límite 5%
  // CONFIRMADO con fuente (NEC 210.19(A) Nota informativa N.° 4 +
  // 215.2(A)(1) Nota informativa N.° 2) — ver
  // TableroMediator.caidaAcumuladaDesdeCircuito y
  // modules/motor/caidaTensionAcumulada.js. Deriva una copia de
  // `resultados` con una advertencia extra cuando corresponde; NO toca
  // `resultados` (sigue siendo la fuente para totales, para
  // `alimentadores` de arriba, y para detalleElectrico).
  //
  // - ciclo / tramoFallido -> advertencia (no se pudo determinar, y por
  //   qué) — son datos rotos o un tramo que ya falló por su cuenta,
  //   vale la pena que se vean aunque no se sepa el % final.
  // - noDeterminado (falta un tramo por calcular) -> no se muestra
  //   nada, igual que cuando falta cualquier otro dato del proyecto.
  // - excede -> advertencia con el % total Y la cantidad de tramos
  //   sobre los que se calculó (nunca el número solo).
  const resultadosParaTabla = useMemo(() => {
    return resultados.map((r) => {
      if (!r.ok) return r;
      const circuito = circuitos.find((c) => c.id === r.id);
      if (!circuito) return r;

      const acumulada = App.tablero.caidaAcumuladaDesdeCircuito(circuito, {
        tableros,
        circuitos,
        resultados,
        normativaId: normativaActiva,
        resultadoCircuito: r,
        equipos,
        fuentesEnergia,
        transformadores,
        tipoInstalacion,
      });

      if (!acumulada.aplica || acumulada.noDeterminado) return r;

      if (acumulada.ciclo || acumulada.tramoFallido) {
        return {
          ...r,
          advertencias: [
            ...r.advertencias,
            `Caída de tensión acumulada NO se pudo determinar: ${acumulada.error ?? acumulada.motivo}`,
          ],
        };
      }

      if (!acumulada.excede) return r;

      return {
        ...r,
        advertencias: [
          ...r.advertencias,
          `Caída de tensión ACUMULADA ${acumulada.totalPct.toFixed(2)}% supera el ${acumulada.limitePct}% provisional, calculada sobre ${acumulada.cantidadTramos} tramos (circuito + ${acumulada.cantidadTableros} tablero${acumulada.cantidadTableros !== 1 ? "s" : ""}).`,
        ],
      };
    });
  }, [resultados, circuitos, tableros, normativaActiva, equipos, fuentesEnergia, transformadores, tipoInstalacion]);

  // Integridad vía ValidacionMediator
  const listaIntegridad = useMemo(
    () => App.validacion.listaIntegridad(proyecto, circuitos, equipos, tableros, fuentesEnergia, nodosDiagrama, transformadores, marcadoresEquipoPlano, diferenciales, rutasConductorPlano),
    [proyecto, circuitos, equipos, tableros, fuentesEnergia, nodosDiagrama, transformadores, marcadoresEquipoPlano, diferenciales, rutasConductorPlano]
  );

  const resumenInt = useMemo(
    () => App.validacion.resumen(proyecto, circuitos, equipos, tableros, fuentesEnergia, nodosDiagrama, transformadores, marcadoresEquipoPlano, diferenciales, rutasConductorPlano),
    [proyecto, circuitos, equipos, tableros, fuentesEnergia, nodosDiagrama, transformadores, marcadoresEquipoPlano, diferenciales, rutasConductorPlano]
  );

  // Desincronización entre la "Distancia (m)"/"Longitud alimentador"
  // escrita a mano y la longitud REAL de la ruta del Plano vinculada a
  // ese circuito/tablero (usuario, 2026-11-25: "¿cómo está validado ese
  // dato?" — "Usar esta longitud" solo copia UNA VEZ, nunca mantiene un
  // vínculo vivo; si el trazo cambia después, o el campo se edita a
  // mano, quedaban desincronizados en silencio, sin ningún aviso). Usa
  // el mismo cálculo EXACTO que "Usar esta longitud" en PlanoInteligente
  // (calcularLongitudEsperadaRuta, trazado + cruces de pared + la
  // bajada/subida al equipo si tiene altura de instalación cargada) —
  // así, apenas se aplica, esta advertencia desaparece sola, nunca
  // queda en desacuerdo con el propio botón que la resuelve. Vive acá
  // (no en ValidacionMediator/referencial.ts) porque necesita geometría
  // del Plano, que ese módulo nunca cruza a propósito (ver su nota de
  // cabecera) — mismo criterio que alimentadores/balancesFases arriba.
  const desincronizacionRutas = useMemo(() => {
    const segmentosPared = segmentosPlano.filter((s) => s.tipo === "pared");
    const resultado = [];
    for (const ruta of rutasConductorPlano) {
      if (!ruta.entidadId || !ruta.entidadTipo) continue;
      const entidad =
        ruta.entidadTipo === "circuito" ? circuitos.find((c) => c.id === ruta.entidadId) : tableros.find((t) => t.id === ruta.entidadId);
      if (!entidad) continue;
      const valorActual = ruta.entidadTipo === "circuito" ? entidad.distancia : entidad.longitudAlimentador;
      if (valorActual == null || valorActual === "") continue;
      const { longitudTotalConAlturaM } = App.plano.calcularLongitudEsperadaRuta(
        ruta,
        nodosPlano,
        segmentosPared,
        marcadoresEquipoPlano,
        equipos,
        habitacionesPlano,
        alturaTechoPlanoM
      );
      const diferenciaM = Math.abs(Number(valorActual) - longitudTotalConAlturaM);
      // 2cm de tolerancia — ruido de redondeo (el campo real queda
      // redondeado a cm, ver aplicarLongitudRutaPlano), no una
      // diferencia real que valga la pena avisar.
      if (diferenciaM > 0.02) {
        resultado.push({
          entidadId: ruta.entidadId,
          entidadTipo: ruta.entidadTipo,
          rutaNombre: ruta.nombre,
          valorActual: Number(valorActual),
          valorEsperado: longitudTotalConAlturaM,
        });
      }
    }
    return resultado;
  }, [rutasConductorPlano, nodosPlano, segmentosPlano, marcadoresEquipoPlano, equipos, habitacionesPlano, alturaTechoPlanoM, circuitos, tableros]);

  // "Caja de empalme... sepa qué circuito(s) pasan por ella" (usuario,
  // 2026-11-26) — ver PlanoMediator.entidadesPorCajaEmpalme para el
  // criterio completo (solo rutas YA vinculadas, nunca una generada
  // automáticamente pero sin confirmar).
  const entidadesPorCajaEmpalme = useMemo(
    () => App.plano.entidadesPorCajaEmpalme({ marcadores: marcadoresEquipoPlano, nodos: nodosPlano, rutas: rutasConductorPlano, circuitos, tableros }),
    [marcadoresEquipoPlano, nodosPlano, rutasConductorPlano, circuitos, tableros]
  );

  // Protección GFCI por ambiente (NEC 210.8(A)/(B)) — usuario,
  // 2026-11-25/26: "el tipo de tomacorriente... y el ambiente donde se
  // localiza". Gateado a NEC/CIEN (mismo criterio que el resto de la
  // app trata a CIEN como la misma base normativa que NEC, ver
  // proteccionTransformador.ts) — bajo REBT queda vacío, sin cita
  // propia para esto todavía. Solo marcadores tipo "contacto"
  // (tomacorriente) — una luminaria o un motor no es lo que 210.8
  // regula. Ver modules/plano/proteccionGFCI.ts: clasifica por tipo
  // de ambiente completo (no por distancia a un fregadero/mesón) —
  // exacto bajo NEC 2023 210.8(A)(6), que eliminó esa condición de
  // distancia/mesón.
  const advertenciasGFCI = useMemo(() => {
    if (normativaActiva !== "NEC" && normativaActiva !== "CIEN") return [];
    const esResidencial = tipoInstalacion !== TIPOS_INSTALACION.COMERCIAL_INDUSTRIAL;
    const resultado = [];
    for (const marcador of marcadoresEquipoPlano) {
      if (marcador.tipo !== "contacto" || !marcador.entidadId) continue;
      const equipo = equipos.find((e) => e.id === marcador.entidadId);
      if (!equipo || equipo.proteccionGFCI) continue;
      const ambiente = App.plano.habitacionQueContiene(marcador.punto, habitacionesPlano, nodosPlano);
      const { requiere, motivo } = App.plano.requiereProteccionGFCI(ambiente?.tipoAmbiente, ambiente?.exterior ?? false, esResidencial);
      if (requiere) {
        resultado.push({ equipoId: equipo.id, marcadorId: marcador.id, motivo });
      }
    }
    return resultado;
  }, [normativaActiva, tipoInstalacion, marcadoresEquipoPlano, equipos, habitacionesPlano, nodosPlano]);

  // Protección AFCI por ambiente (NEC 210.12(B)) — usuario, 2026-11-26,
  // "sigamos con AFCI". A diferencia de GFCI (protege un receptáculo),
  // 210.12(B) protege el CIRCUITO ramal completo — por eso el checkbox
  // vive en el circuito, y la advertencia dispara si CUALQUIERA de sus
  // equipos cae en un ambiente de la lista (no solo uno, como en GFCI).
  // Mismo gateo NEC/CIEN que advertenciasGFCI. Ver modules/plano/proteccionAFCI.ts.
  const advertenciasAFCI = useMemo(() => {
    if (normativaActiva !== "NEC" && normativaActiva !== "CIEN") return [];
    const resultado = [];
    for (const circuito of circuitos) {
      if (circuito.proteccionAFCI) continue;
      const equiposDelCircuito = equipos.filter((e) => e.circuitoId === circuito.id);
      for (const equipo of equiposDelCircuito) {
        const marcador = marcadoresEquipoPlano.find((m) => m.entidadId === equipo.id);
        if (!marcador) continue;
        const ambiente = App.plano.habitacionQueContiene(marcador.punto, habitacionesPlano, nodosPlano);
        const { requiere, motivo } = App.plano.requiereProteccionAFCI(ambiente?.tipoAmbiente);
        if (requiere) {
          resultado.push({ circuitoId: circuito.id, equipoId: equipo.id, motivo });
          break; // un motivo alcanza para avisar de este circuito — no hace falta uno por cada equipo que califique
        }
      }
    }
    return resultado;
  }, [normativaActiva, circuitos, equipos, marcadoresEquipoPlano, habitacionesPlano, nodosPlano]);

  // Volúmenes de seguridad del baño — REBT ITC-BT-27 (usuario,
  // 2026-11-26, "sigamos" con esto tras confirmar la Tabla 1 exacta en
  // el texto consolidado del REBT, BOE-A-2002-18099). Solo IEC_ES —
  // concepto propio de REBT, sin equivalente NEC/CIEN modelado acá. Un
  // "contacto" (tomacorriente) dentro del radio Volumen 0/1/2 de la
  // fuente de agua más cercana es un ERROR (la norma dice "No
  // permitida", no es solo una recomendación); dentro de Volumen 3 es
  // una ADVERTENCIA si su circuito no tiene un diferencial de ≤30mA
  // asignado. Ver modules/plano/volumenesBano.ts para la
  // simplificación deliberada (distancia horizontal únicamente).
  const advertenciasVolumenBano = useMemo(() => {
    if (normativaActiva !== "IEC_ES") return [];
    const resultado = [];
    for (const marcador of marcadoresEquipoPlano) {
      if (marcador.tipo !== "contacto") continue;
      // Altura real (ITC-BT-27 §2.1.2/3/4, ver volumenesBano.ts) — el
      // mismo par altura-de-instalación/altura-de-techo que ya resuelve
      // calcularExtraAlturaInstalacion, acá para EXIMIR (nunca agravar)
      // un punto que por distancia horizontal cae en zona restringida.
      // Sin alguno de los 2 datos, exactamente el comportamiento
      // horizontal de siempre (ver evaluarZonaBano, nunca se adivina).
      const equipoDelMarcador = marcador.entidadId ? equipos.find((e) => e.id === marcador.entidadId) : null;
      const alturaPuntoM =
        equipoDelMarcador?.alturaInstalacionM === "" || equipoDelMarcador?.alturaInstalacionM == null ? null : Number(equipoDelMarcador.alturaInstalacionM);
      const ambienteDelMarcador = App.plano.habitacionQueContiene(marcador.punto, habitacionesPlano, nodosPlano);
      const alturaTechoM = ambienteDelMarcador?.alturaM ?? alturaTechoPlanoM ?? null;
      const zona = App.plano.evaluarZonaBano(marcador.punto, marcadoresEquipoPlano, alturaPuntoM, alturaTechoM);
      if (!zona || zona.zona === "fuera") continue;
      if (zona.zona === "prohibido") {
        resultado.push({ marcadorId: marcador.id, equipoId: marcador.entidadId, nivel: "error", motivo: zona.motivo, distanciaM: zona.distanciaM });
        continue;
      }
      // zona.zona === "volumen_3": permitido, pero exige diferencial ≤30mA.
      const circuito = equipoDelMarcador?.circuitoId ? circuitos.find((c) => c.id === equipoDelMarcador.circuitoId) : null;
      const diferencial = circuito?.diferencialId ? diferenciales.find((d) => d.id === circuito.diferencialId) : null;
      const protegido = diferencial != null && Number(diferencial.sensibilidadMA) <= App.plano.SENSIBILIDAD_MAXIMA_VOLUMEN3_MA;
      if (!protegido) {
        resultado.push({ marcadorId: marcador.id, equipoId: marcador.entidadId, nivel: "advertencia", motivo: zona.motivo, distanciaM: zona.distanciaM });
      }
    }
    return resultado;
  }, [normativaActiva, marcadoresEquipoPlano, equipos, circuitos, diferenciales, habitacionesPlano, nodosPlano, alturaTechoPlanoM]);

  // Diferencial faltante bajo REBT — ITC-BT-25 §2.1 (usuario,
  // 2026-11-26, "citar normativas para las distancias de instalación"
  // — investigando el equivalente REBT de GFCI/AFCI, que hasta esta
  // ronda no tenían ninguna cita propia bajo IEC_ES). A diferencia de
  // GFCI/AFCI (NEC, por tipo de ambiente), REBT exige diferencial
  // ≤30mA en TODOS los circuitos sin excepción — por eso recorre TODOS
  // los circuitos, no solo los de cierto ambiente. Ver
  // modules/diferencial/index.ts para la cita completa y la nota sobre
  // por qué NO existe un equivalente de AFCI en REBT (no es una laguna
  // de esta app).
  const advertenciasDiferencialREBT = useMemo(() => {
    if (normativaActiva !== "IEC_ES") return [];
    return circuitos
      .map((c) => ({ circuitoId: c.id, ...App.diferencial.requiereDiferencial(c) }))
      .filter((r) => r.requiere);
  }, [normativaActiva, circuitos]);

  const detalleElectrico = useCallback(
    (id) =>
      App.validacion.detalleElectrico(id, {
        proyecto,
        circuitos,
        equipos,
        normativaId: normativaActiva,
        resultadoCalculo: resultados.find((r) => r.id === id) || null,
      }),
    [proyecto, circuitos, equipos, resultados, normativaActiva]
  );

  function setNormativaActiva(id) {
    setNormativaActivaBase(id);
    if (!formCircuito.voltajeManual) {
      const voltajes = App.normativa.voltajesPorFase(id, formCircuito.fases);
      if (voltajes[0] !== undefined) {
        setFormCircuito((f) => ({ ...f, voltaje: String(voltajes[0]) }));
      }
    }
  }

  function cambiarFasesCircuito(nuevaFase) {
    const voltajes = App.normativa.voltajesPorFase(normativaActiva, nuevaFase);
    setFormCircuito({
      ...formCircuito,
      fases: nuevaFase,
      voltaje: formCircuito.voltajeManual
        ? formCircuito.voltaje
        : String(voltajes[0] ?? formCircuito.voltaje),
    });
  }

  // --- CIRCUITO ---
  // Sistema de etiquetado (ver modules/etiquetado/index.js) — sugiere
  // "C{n}" al abrir el formulario para un circuito NUEVO. Un circuito
  // todavía no tiene tablero asignado en este punto del flujo (eso
  // pasa después, desde TablaResultados — ver asignarCircuitoATablero
  // más abajo), así que la sugerencia es project-wide, sin prefijo de
  // tablero; el usuario la puede reescribir a mano (ej. "TD1-C3") una
  // vez que sepa a qué tablero va. Nunca pisa un valor que el usuario
  // ya haya tocado — solo se calcula al resetear a un formulario vacío.
  function formCircuitoVacioConSugerencia() {
    return { ...CIRCUITO_VACIO, etiqueta: App.etiquetado.sugerirCircuito(null, circuitos) };
  }

  function guardarCircuito() {
    const error = App.validacion.validarFormularioCircuito(formCircuito);
    if (error) return setErrorCircuito(error);
    setErrorCircuito("");
    const circuito = App.validacion.formularioACircuito(
      formCircuito,
      editandoCircuitoId
    );

    let circuitosActualizados;
    if (editandoCircuitoId) {
      circuitosActualizados = circuitos.map((c) => (c.id === editandoCircuitoId ? circuito : c));
      setCircuitos(circuitosActualizados);
    } else {
      circuitosActualizados = [...circuitos, circuito];
      setCircuitos(circuitosActualizados);
      setCircuitoActivoId(circuito.id);
      // El circuito recién creado queda activo de una — la etiqueta
      // sugerida del formulario de equipo debe reflejar ESE circuito,
      // no el que estaba activo antes (o ninguno). Solo toca `etiqueta`
      // (no todo el formulario): si el usuario ya había empezado a
      // escribir un equipo antes de crear este circuito, no se pierde.
      if (!editandoEquipoId) {
        const sugerido = formEquipoVacioConSugerencia(equipos, circuito.id, circuitosActualizados);
        setFormEquipo((prev) => ({ ...prev, etiqueta: sugerido.etiqueta }));
      }
    }
    setEditandoCircuitoId(null);
    setFormCircuito({ ...CIRCUITO_VACIO, etiqueta: App.etiquetado.sugerirCircuito(null, circuitosActualizados) });
  }

  function iniciarEdicionCircuito(id) {
    const circuito = circuitos.find((c) => c.id === id);
    if (!circuito) return;
    setFormCircuito(App.validacion.circuitoAFormulario(circuito));
    setEditandoCircuitoId(id);
    setErrorCircuito("");
  }

  function cancelarEdicionCircuito() {
    setFormCircuito(formCircuitoVacioConSugerencia());
    setEditandoCircuitoId(null);
    setErrorCircuito("");
  }

  function eliminarCircuito(id) {
    // Los equipos de este circuito se eliminan en cascada — y con ellos,
    // los nodos del diagrama que los representaban quedan desvinculados
    // (mismo criterio que eliminarEquipo, no queda ningún entidadId muerto).
    const equiposDelCircuito = equipos.filter((e) => e.circuitoId === id);
    let nodosLiberados = nodosDiagrama;
    for (const equipo of equiposDelCircuito) {
      nodosLiberados = App.diagrama.liberarNodosDeEntidad(equipo.id, nodosLiberados);
    }
    setNodosDiagrama(nodosLiberados);
    // Mismo criterio que arriba, pero para marcadores del PLANO — bug
    // preexistente encontrado al agregar el marcador de Circuito
    // (usuario, 2026-11-25): eliminarEquipo/Circuito/Tablero/
    // FuenteEnergia/Transformador limpiaban sus nodos del diagrama,
    // pero NUNCA sus marcadores del plano — quedaban apuntando a un
    // entidadId muerto. Se libera primero el marcador del propio
    // circuito, y después el de cada uno de sus equipos (en cascada,
    // igual que el resto de esta función).
    let marcadoresLiberados = App.plano.liberarMarcadoresDeEntidad(id, marcadoresEquipoPlano);
    for (const equipo of equiposDelCircuito) {
      marcadoresLiberados = App.plano.liberarMarcadoresDeEntidad(equipo.id, marcadoresLiberados);
    }
    setMarcadoresEquipoPlano(marcadoresLiberados);
    // Idem para rutas de conductor del plano vinculadas a este circuito
    // (bug real encontrado en auditoría, 2026-11-26: esta liberación NO
    // existía — la ruta quedaba con un entidadId muerto para siempre).
    setRutasConductorPlano(App.plano.liberarRutasDeEntidad(id, rutasConductorPlano));
    setCircuitos(circuitos.filter((c) => c.id !== id));
    setEquipos(equipos.filter((e) => e.circuitoId !== id));
    if (circuitoActivoId === id) setCircuitoActivoId(null);
  }

  // Edición liviana de nombre/etiqueta/función — SOLO esos 3 campos de
  // presentación (ver modules/etiquetado/index.js: "puede repetirse o
  // quedar vacía sin romper nada"), a propósito SIN pasar por
  // guardarCircuito()/validarFormularioEquipo() (esa validación es para
  // los campos eléctricos). Pensada para Directorio.jsx (árbol plegable
  // editable, pedido explícito del usuario 2026-11-20) — misma idea que
  // editarTablero, que ya patcheaba directo.
  function editarEtiquetaFuncionCircuito(id, { nombre, etiqueta, funcion } = {}) {
    setCircuitos(
      circuitos.map((c) =>
        c.id === id ? { ...c, nombre: nombre ?? c.nombre, etiqueta: etiqueta ?? c.etiqueta, funcion: funcion ?? c.funcion } : c
      )
    );
  }

  // --- EQUIPO ---
  // Mismo criterio que formCircuitoVacioConSugerencia, pero un equipo
  // SÍ tiene un circuito conocido en este punto (circuitoActivoId) —
  // la sugerencia usa la etiqueta de ESE circuito como prefijo (ej.
  // "TD1-C3-E1"), o cae a "E{n}" a secas si el circuito todavía no
  // tiene etiqueta propia.
  // `circuitosActuales`/`circuitoIdActual` son opcionales — por defecto
  // usan el estado del hook (`circuitos`/`circuitoActivoId`), pero
  // guardarCircuito() los pasa explícitos cuando ACABA de crear y
  // activar un circuito nuevo: `setCircuitoActivoId` todavía no se
  // refleja en este mismo closure (React no actualiza el estado hasta
  // el próximo render), así que sin este parámetro la sugerencia del
  // equipo se calcularía contra el circuito activo VIEJO.
  function formEquipoVacioConSugerencia(equiposActuales, circuitoIdActual = circuitoActivoId, circuitosActuales = circuitos) {
    const circuito = circuitosActuales.find((c) => c.id === circuitoIdActual);
    const equiposDelCircuito = equiposActuales.filter((e) => e.circuitoId === circuitoIdActual);
    return { ...EQUIPO_VACIO, etiqueta: App.etiquetado.sugerirEquipo(circuito?.etiqueta, equiposDelCircuito) };
  }

  function guardarEquipo() {
    if (!circuitoActivoId) {
      return setErrorEquipo("Primero crea o selecciona un circuito.");
    }
    const error = App.validacion.validarFormularioEquipo(formEquipo);
    if (error) return setErrorEquipo(error);
    setErrorEquipo("");
    const equipo = App.validacion.formularioAEquipo(
      formEquipo,
      circuitoActivoId,
      editandoEquipoId
    );

    let equiposActualizados;
    if (editandoEquipoId) {
      equiposActualizados = equipos.map((e) => (e.id === editandoEquipoId ? equipo : e));
      setEquipos(equiposActualizados);
    } else {
      equiposActualizados = [...equipos, equipo];
      setEquipos(equiposActualizados);
    }
    setEditandoEquipoId(null);
    setFormEquipo(formEquipoVacioConSugerencia(equiposActualizados));
  }

  function iniciarEdicionEquipo(id) {
    const equipo = equipos.find((e) => e.id === id);
    if (!equipo) return;
    setFormEquipo(App.validacion.equipoAFormulario(equipo));
    setEditandoEquipoId(id);
    setCircuitoActivoId(equipo.circuitoId);
    setErrorEquipo("");
  }

  function cancelarEdicionEquipo() {
    setFormEquipo(formEquipoVacioConSugerencia(equipos));
    setEditandoEquipoId(null);
    setErrorEquipo("");
  }

  function eliminarEquipo(id) {
    // Desvincula (no borra) los nodos del diagrama que representaban este equipo.
    setNodosDiagrama(App.diagrama.liberarNodosDeEntidad(id, nodosDiagrama));
    // Idem para su marcador del plano — ver nota en eliminarCircuito.
    setMarcadoresEquipoPlano(App.plano.liberarMarcadoresDeEntidad(id, marcadoresEquipoPlano));
    setEquipos(equipos.filter((e) => e.id !== id));
    if (editandoEquipoId === id) cancelarEdicionEquipo();
  }

  // Mismo criterio que editarEtiquetaFuncionCircuito — ver esa nota.
  function editarEtiquetaFuncionEquipo(id, { nombre, etiqueta, funcion } = {}) {
    setEquipos(
      equipos.map((e) =>
        e.id === id ? { ...e, nombre: nombre ?? e.nombre, etiqueta: etiqueta ?? e.etiqueta, funcion: funcion ?? e.funcion } : e
      )
    );
  }

  // --- CÁLCULO DE ILUMINACIÓN GENERAL (NEC Tabla 220.12) ---
  // Usuario, 2026-11-23: quería saber para qué sirve el área
  // construida de un plano — esto la conecta a un cálculo real en vez
  // de quedar solo como dato descriptivo. Área × VA/m²
  // (normativa.cargaIluminacionGeneralVaPorM2 — SOLO NEC/CIEN lo
  // definen, ver modules/normativa/tipos.ts) = la carga de alumbrado
  // general OBLIGATORIA por NEC Art. 220.12, independiente de cuántos
  // focos haya instalados realmente. Crea un circuito + 1 equipo
  // (tipoEquipoNEC: ILUMINACION_GENERAL, que ya activa la demanda
  // escalonada de Art. 220.42 — mismo motor que cualquier otro
  // circuito, no es un camino de cálculo aparte) — igual que un
  // circuito tipeado a mano, sin tablero asignado todavía (el usuario
  // lo asigna después, como cualquier circuito nuevo).
  function crearCircuitoIluminacionGeneral(areaM2, normativaActiva) {
    const normativa = App.normativa.obtener(normativaActiva);
    const vaPorM2 = normativa.cargaIluminacionGeneralVaPorM2;
    if (!vaPorM2 || !(areaM2 > 0)) return null;
    const va = Math.round(areaM2 * vaPorM2);

    const voltajeDefecto = normativa.voltajesPorFase?.mono?.[0] ?? 120;
    const formCircuito = {
      ...CIRCUITO_VACIO,
      nombre: "Iluminación general",
      etiqueta: App.etiquetado.sugerirCircuito(null, circuitos),
      fases: "mono",
      voltaje: String(voltajeDefecto),
      distancia: "0",
      temp: "30",
    };
    const circuito = App.validacion.formularioACircuito(formCircuito, null);

    const formEquipo = {
      ...EQUIPO_VACIO,
      nombre: "Carga general de iluminación (NEC 220.12)",
      funcion: `Área construida: ${areaM2} m² × ${vaPorM2} VA/m²`,
      cantidad: "1",
      modoEntrada: "potencia",
      valor: String(va),
      tipoEquipoNEC: "ILUMINACION_GENERAL",
    };
    const equipo = App.validacion.formularioAEquipo(formEquipo, circuito.id, null);

    setCircuitos([...circuitos, circuito]);
    setEquipos([...equipos, equipo]);
    return { circuito, equipo, va };
  }

  // --- IMPORTACIÓN DE EQUIPOS POR TEXTO (2026-11-20) ---
  // Pedido explícito del usuario, alcance acotado (discutido y
  // aceptado): SOLO crea equipos, nunca tableros/circuitos — deben
  // existir de antes, referenciados por su etiqueta ya construida
  // (ver ImportacionMediator para el porqué completo). No es un
  // camino de cálculo nuevo: reusa la misma validación/fábrica que el
  // formulario manual, línea por línea.
  function previsualizarImportacionEquipos(texto) {
    return App.importacion.previsualizar(texto, circuitos);
  }

  // Confirma una previsualización YA vista por el usuario — inserta
  // los equipos (ya armados por previsualizarImportacionEquipos, no
  // se vuelven a interpretar/validar acá) tal cual, de una sola vez.
  //
  // También arma el diagrama unifilar de cada equipo nuevo (usuario,
  // 2026-11-23, mismo pedido que para la importación por PDF+IA: "que
  // también corra con la importación de equipos por texto") — a
  // diferencia de esa, acá el circuito YA existe (puede o no tener
  // tablero asignado, y ese tablero puede o no tener ya su propio nodo
  // de diagrama de antes) — por eso se busca/reusa el nodo del tablero
  // en vez de crear uno siempre, para no duplicar lo que el usuario ya
  // armó a mano. Sin tablero asignado, el equipo queda sin nodo (no
  // hay de dónde colgarlo) — la advertencia de integridad existente ya
  // avisa de eso, no hace falta inventar nada acá.
  function confirmarImportacionEquipos(filasPrevisualizadas) {
    const nuevos = filasPrevisualizadas.filter((f) => f.ok).map((f) => f.equipo);
    if (nuevos.length === 0) return 0;

    const nodosAcumulados = [...nodosDiagrama];
    const conexionesAcumuladas = [...conexionesDiagrama];

    function conectar(origenId, destinoId) {
      const resultado = App.diagrama.crearConexionValidada({ nodoOrigenId: origenId, nodoDestinoId: destinoId }, nodosAcumulados, conexionesAcumuladas);
      if (resultado.ok) conexionesAcumuladas.push(resultado.conexion);
    }

    function nodoDeTablero(tableroId) {
      const existente = nodosAcumulados.find((n) => n.tipo === "tablero_electrico" && n.entidadId === tableroId);
      if (existente) return existente;
      const tablero = tableros.find((t) => t.id === tableroId);
      if (!tablero) return null;
      const nodo = App.diagrama.crearNodo({ tipo: "tablero_electrico", nombre: tablero.nombre, entidadId: tablero.id });
      nodosAcumulados.push(nodo);
      const nodoAcometida = App.diagrama.crearNodo({ tipo: "acometida", nombre: "Red eléctrica local" });
      nodosAcumulados.push(nodoAcometida);
      conectar(nodoAcometida.id, nodo.id);
      return nodo;
    }

    nuevos.forEach((equipo) => {
      const circuito = circuitos.find((c) => c.id === equipo.circuitoId);
      if (!circuito?.tableroId) return;
      const nodoTablero = nodoDeTablero(circuito.tableroId);
      if (!nodoTablero) return;
      const nodoEquipo = App.diagrama.crearNodo({ tipo: App.diagrama.elegirSimboloEquipo(equipo), nombre: equipo.nombre, entidadId: equipo.id });
      nodosAcumulados.push(nodoEquipo);
      conectar(nodoTablero.id, nodoEquipo.id);
    });

    setEquipos([...equipos, ...nuevos]);
    if (nodosAcumulados.length > nodosDiagrama.length) {
      const posiciones = App.diagrama.autoorganizar(nodosAcumulados, conexionesAcumuladas);
      setNodosDiagrama(nodosAcumulados.map((n) => (posiciones[n.id] ? { ...n, posicion: posiciones[n.id] } : n)));
      setConexionesDiagrama(conexionesAcumuladas);
    }
    return nuevos.length;
  }

  function equiposDe(circuitoId) {
    return equipos.filter((e) => e.circuitoId === circuitoId);
  }

  // --- IMPORTACIÓN DE PROYECTO DESDE PDF CON IA LOCAL (2026-11-23) ---
  // Pedido explícito del usuario: a diferencia de "Importación de
  // equipos por texto" (que solo agrega equipos a circuitos ya
  // creados), acá SÍ se crean tableros y circuitos nuevos — es el
  // reemplazo de cargar un proyecto real desde cero a mano. El texto
  // del documento ya pasó por la IA local y el adaptador (ver
  // modules/iaLocal/adaptador.ts) ANTES de llegar acá — esta función
  // solo inserta lo que el usuario ya confirmó en la vista previa, con
  // la MISMA validación/fábrica que el resto de la app (nunca un
  // camino de cálculo paralelo). Un solo setState por array (mismo
  // criterio que confirmarImportacionEquipos) para no pisarse entre
  // inserciones de varios tableros/circuitos de una sola vez.
  // También arma el diagrama unifilar de lo importado (usuario,
  // 2026-11-23, "la IA hace un etiquetado referencial... para agilizar
  // todo"): un nodo "Acometida" + un nodo del tablero (vinculado,
  // mismo criterio que el resto de la app: entidadId, nunca duplica
  // datos) + un nodo por cada equipo importado, conectados
  // Acometida→Tablero→cada equipo. El símbolo de cada equipo lo elige
  // elegirSimboloEquipo() por palabras clave en su nombre (luminaria/
  // motor/contacto/variantes de control); cuando no reconoce nada cae
  // a "carga_especial", nunca adivina de más. Nada de esto necesita la
  // IA de nuevo: es mecánico, reusa las MISMAS fábricas/validación de
  // cardinalidad que si lo armaras a mano arrastrando símbolos — por
  // eso el nombre del nodo vinculado queda "vivo" (sigue el de la
  // entidad real) sin código extra.
  function confirmarImportacionProyectoPDF(tablerosParaImportar) {
    const nuevosTableros = [];
    const nuevosCircuitos = [];
    const nuevosEquipos = [];
    const nodosAcumulados = [...nodosDiagrama];
    const conexionesAcumuladas = [...conexionesDiagrama];

    function agregarNodo(datos) {
      const nodo = App.diagrama.crearNodo(datos);
      nodosAcumulados.push(nodo);
      return nodo;
    }

    function conectar(origenId, destinoId) {
      const resultado = App.diagrama.crearConexionValidada({ nodoOrigenId: origenId, nodoDestinoId: destinoId }, nodosAcumulados, conexionesAcumuladas);
      if (resultado.ok) conexionesAcumuladas.push(resultado.conexion);
    }

    tablerosParaImportar.forEach((t) => {
      const tablero = App.tablero.crear(t.datos);
      nuevosTableros.push(tablero);

      const nodoAcometida = agregarNodo({ tipo: "acometida", nombre: "Red eléctrica local" });
      const nodoTablero = agregarNodo({ tipo: "tablero_electrico", nombre: tablero.nombre, entidadId: tablero.id });
      conectar(nodoAcometida.id, nodoTablero.id);

      t.circuitos
        .filter((c) => c.incluir && c.valido)
        .forEach((c) => {
          const circuito = App.validacion.formularioACircuito({ ...c.form, tableroId: tablero.id }, null);
          nuevosCircuitos.push(circuito);
          if (c.equipoForm) {
            const equipo = App.validacion.formularioAEquipo(c.equipoForm, circuito.id, null);
            nuevosEquipos.push(equipo);
            const nodoEquipo = agregarNodo({ tipo: App.diagrama.elegirSimboloEquipo(equipo), nombre: equipo.nombre, entidadId: equipo.id });
            conectar(nodoTablero.id, nodoEquipo.id);
          }
        });
    });

    if (nuevosTableros.length > 0) setTableros([...tableros, ...nuevosTableros]);
    if (nuevosCircuitos.length > 0) setCircuitos([...circuitos, ...nuevosCircuitos]);
    if (nodosAcumulados.length > nodosDiagrama.length) {
      const posiciones = App.diagrama.autoorganizar(nodosAcumulados, conexionesAcumuladas);
      setNodosDiagrama(nodosAcumulados.map((n) => (posiciones[n.id] ? { ...n, posicion: posiciones[n.id] } : n)));
      setConexionesDiagrama(conexionesAcumuladas);
    }
    if (nuevosEquipos.length > 0) setEquipos([...equipos, ...nuevosEquipos]);

    return { tableros: nuevosTableros.length, circuitos: nuevosCircuitos.length, equipos: nuevosEquipos.length };
  }

  // --- TABLERO (Fase 3 dato relacional + Fase 4 alimentador) ---
  function crearTablero(datos) {
    const tablero = App.tablero.crear(datos);
    setTableros([...tableros, tablero]);
    return tablero;
  }

  function editarTablero(id, cambios) {
    const tablero = tableros.find((t) => t.id === id);
    if (!tablero) return;
    const actualizado = App.tablero.editar(tablero, cambios);
    setTableros(tableros.map((t) => (t.id === id ? actualizado : t)));
  }

  function eliminarTablero(id) {
    // Libera los circuitos que le pertenecían (no los borra, no quedan
    // apuntando a un ID muerto) y los nodos del diagrama que lo
    // representaban (idem, desvinculados, no borrados) y recién
    // después quita el tablero.
    setCircuitos(App.tablero.liberarCircuitos(id, circuitos));
    setNodosDiagrama(App.diagrama.liberarNodosDeEntidad(id, nodosDiagrama));
    // Idem para su marcador del plano — ver nota en eliminarCircuito.
    setMarcadoresEquipoPlano(App.plano.liberarMarcadoresDeEntidad(id, marcadoresEquipoPlano));
    // Idem para rutas de conductor vinculadas a este tablero — ver
    // misma nota de auditoría en eliminarCircuito.
    setRutasConductorPlano(App.plano.liberarRutasDeEntidad(id, rutasConductorPlano));
    setTableros(tableros.filter((t) => t.id !== id));
  }

  // --- FUENTE DE ENERGÍA (Red local/Batería/Generador, origen alternativo
  // de un tablero) --- El `rol` (principal/secundaria/auxiliar) es GLOBAL
  // de la instalación, no por fuente aislada: tras crear/editar, se
  // limpia de cualquier otra fuente que lo tuviera, para que nunca haya
  // dos con el mismo rol (ver limpiarRolDuplicado en fuentesEnergia.js).
  function crearFuenteEnergia(datos) {
    const fuente = App.origen.crearFuente(datos);
    const lista = App.origen.limpiarRolDuplicado([...fuentesEnergia, fuente], fuente.id, fuente.rol);
    setFuentesEnergia(lista);
    return fuente;
  }

  function editarFuenteEnergia(id, cambios) {
    const fuente = fuentesEnergia.find((f) => f.id === id);
    if (!fuente) return;
    const actualizada = App.origen.editarFuente(fuente, cambios);
    const lista = App.origen.limpiarRolDuplicado(
      fuentesEnergia.map((f) => (f.id === id ? actualizada : f)),
      id,
      actualizada.rol
    );
    setFuentesEnergia(lista);
  }

  function eliminarFuenteEnergia(id) {
    // Libera (no rompe) los tableros que la tenían como origen y los
    // nodos del diagrama que la representaban.
    setTableros(App.origen.liberarTableros(id, tableros));
    setNodosDiagrama(App.diagrama.liberarNodosDeEntidad(id, nodosDiagrama));
    // Idem para su marcador del plano — ver nota en eliminarCircuito.
    setMarcadoresEquipoPlano(App.plano.liberarMarcadoresDeEntidad(id, marcadoresEquipoPlano));
    setFuentesEnergia(fuentesEnergia.filter((f) => f.id !== id));
  }

  // --- TRANSFORMADOR (origen alternativo de un tablero, solo instalaciones
  // industriales — ver tipoInstalacion arriba) ---
  function crearTransformador(datos) {
    const transformador = App.origen.crearTransformador(datos);
    setTransformadores([...transformadores, transformador]);
    return transformador;
  }

  // CRUD completo (usuario, 2026-11-20): mismo patrón exacto que
  // editarFuenteEnergia/eliminarFuenteEnergia — ya existía la base pura
  // (editarTransformador/liberarTablerosDeTransformador en
  // modules/motor/transformador.js, expuesta en OrigenMediator), solo
  // faltaba conectarla al hook y a una UI con lista propia
  // (PanelTransformadores.jsx).
  function editarTransformador(id, cambios) {
    const transformador = transformadores.find((t) => t.id === id);
    if (!transformador) return;
    const actualizado = App.origen.editarTransformador(transformador, cambios);
    setTransformadores(transformadores.map((t) => (t.id === id ? actualizado : t)));
  }

  function eliminarTransformador(id) {
    // Libera (no rompe) los tableros que lo tenían como origen y los
    // nodos del diagrama que lo representaban — igual criterio que
    // eliminarFuenteEnergia.
    setTableros(App.origen.liberarTablerosDeTransformador(id, tableros));
    setNodosDiagrama(App.diagrama.liberarNodosDeEntidad(id, nodosDiagrama));
    // Idem para su marcador del plano — ver nota en eliminarCircuito.
    setMarcadoresEquipoPlano(App.plano.liberarMarcadoresDeEntidad(id, marcadoresEquipoPlano));
    setTransformadores(transformadores.filter((t) => t.id !== id));
  }

  // --- DIFERENCIAL (ID, REBT ITC-BT-25 — agrupa hasta 5 circuitos) ---
  function crearDiferencial(datos) {
    const diferencial = App.diferencial.crear(datos);
    setDiferenciales([...diferenciales, diferencial]);
    return diferencial;
  }

  function editarDiferencial(id, cambios) {
    const diferencial = diferenciales.find((d) => d.id === id);
    if (!diferencial) return;
    const actualizado = App.diferencial.editar(diferencial, cambios);
    setDiferenciales(diferenciales.map((d) => (d.id === id ? actualizado : d)));
  }

  function eliminarDiferencial(id) {
    // Libera (no rompe) los circuitos que agrupaba — mismo criterio que
    // eliminarTablero/eliminarFuenteEnergia/eliminarTransformador. Un
    // diferencial no tiene nodo propio en el diagrama (soloPlano, ver
    // bibliotecaComponentes.js), solo su marcador del plano.
    setCircuitos(App.diferencial.liberarCircuitos(id, circuitos));
    setMarcadoresEquipoPlano(App.plano.liberarMarcadoresDeEntidad(id, marcadoresEquipoPlano));
    setDiferenciales(diferenciales.filter((d) => d.id !== id));
  }

  function asignarCircuitoADiferencial(circuitoId, diferencialId) {
    const circuito = circuitos.find((c) => c.id === circuitoId);
    if (!circuito) return;
    const actualizado = App.diferencial.asignar(circuito, diferencialId);
    setCircuitos(circuitos.map((c) => (c.id === circuitoId ? actualizado : c)));
  }

  // --- DIAGRAMA UNIFILAR (Fase 1: modelo de datos — nodos y conexiones) ---
  function crearNodoDiagrama(datos) {
    const nodo = App.diagrama.crearNodo(datos);
    setNodosDiagrama([...nodosDiagrama, nodo]);
    return nodo;
  }

  function editarNodoDiagrama(id, cambios) {
    const nodo = nodosDiagrama.find((n) => n.id === id);
    if (!nodo) return;
    const actualizado = App.diagrama.editarNodo(nodo, cambios);
    setNodosDiagrama(nodosDiagrama.map((n) => (n.id === id ? actualizado : n)));
  }

  function eliminarNodoDiagrama(id) {
    // Sus conexiones se eliminan con él (no quedan apuntando a un nodo muerto).
    setConexionesDiagrama(App.diagrama.conexionesTrasEliminarNodo(id, conexionesDiagrama));
    setNodosDiagrama(nodosDiagrama.filter((n) => n.id !== id));
  }

  /** Reacomoda TODOS los nodos en capas según el sentido de las conexiones (usuario, 2026-11-20) — un solo update de estado, no uno por nodo. */
  function autoorganizarDiagrama() {
    const posiciones = App.diagrama.autoorganizar(nodosDiagrama, conexionesDiagrama);
    setNodosDiagrama(nodosDiagrama.map((n) => (posiciones[n.id] ? { ...n, posicion: posiciones[n.id] } : n)));
  }

  // Validada contra cardinalidad (ver DiagramaMediator.crearConexionValidada)
  // antes de crearla — devuelve {ok:false, motivo} sin tocar el estado si
  // la conexión propuesta no es válida, en vez de crearla igual.
  function crearConexionDiagrama(datos) {
    const resultado = App.diagrama.crearConexionValidada(datos, nodosDiagrama, conexionesDiagrama);
    if (!resultado.ok) return resultado;
    setConexionesDiagrama([...conexionesDiagrama, resultado.conexion]);
    return resultado;
  }

  function editarConexionDiagrama(id, cambios) {
    const conexion = conexionesDiagrama.find((c) => c.id === id);
    if (!conexion) return;
    const actualizada = App.diagrama.editarConexion(conexion, cambios);
    setConexionesDiagrama(conexionesDiagrama.map((c) => (c.id === id ? actualizada : c)));
  }

  function eliminarConexionDiagrama(id) {
    setConexionesDiagrama(conexionesDiagrama.filter((c) => c.id !== id));
  }

  function asignarCircuitoATablero(circuitoId, tableroId) {
    const circuito = circuitos.find((c) => c.id === circuitoId);
    if (!circuito) return;
    const actualizado = App.tablero.asignar(circuito, tableroId);
    setCircuitos(circuitos.map((c) => (c.id === circuitoId ? actualizado : c)));
  }

  function circuitosDeTablero(tableroId) {
    return App.tablero.circuitosDe(tableroId, circuitos);
  }

  function asignarLineasCircuito(circuitoId, lineas) {
    const circuito = circuitos.find((c) => c.id === circuitoId);
    if (!circuito) return;
    const actualizado = App.tablero.asignarLineas(circuito, lineas);
    setCircuitos(circuitos.map((c) => (c.id === circuitoId ? actualizado : c)));
  }

  // Balance de fases de cada tablero, vía TableroMediator — mismo
  // patrón que `alimentadores` arriba (mapa por tableroId, recalculado
  // cuando cambia cualquier dato que lo afecte). `umbralDesbalanceFasesPct`
  // va explícito como dependencia porque cambiarlo desde Ajustes no
  // cambia tableros/circuitos/resultados — sin esto, useMemo no se
  // volvería a ejecutar y el umbral nuevo no se vería reflejado acá.
  const balancesFases = useMemo(() => {
    const mapa = {};
    tableros.forEach((t) => {
      mapa[t.id] = App.tablero.balanceFasesDeTablero(t.id, {
        tableros,
        circuitos,
        resultados,
        normativaId: normativaActiva,
        umbralPct: umbralDesbalanceFasesPct,
      });
    });
    return mapa;
  }, [tableros, circuitos, resultados, normativaActiva, umbralDesbalanceFasesPct]);

  function circuitosSinTablero() {
    return App.tablero.sinAsignar(circuitos);
  }

  // --- PLANO INTELIGENTE (Fase 1 + soporte PDF de Fase 2) ---
  // Carga el archivo (imagen o PDF) como data URL (embebida en el
  // proyecto, ver la nota en modules/persistencia/proyecto.js sobre
  // por qué). Un PDF se renderiza a un raster de referencia (ver
  // shared/utils/pdfARaster.ts — DPI fijo, independiente del
  // dispositivo) y de ahí en más sigue EXACTAMENTE el mismo flujo que
  // una imagen: ningún otro código (calibración/trazado/render/
  // persistencia) distingue de dónde salió el raster. Al cargar un
  // plano NUEVO se resetea todo lo demás del plano (calibración/
  // nodos/segmentos/habitaciones no tendrían sentido sobre un fondo
  // distinto) — mismo criterio que nuevoProyecto() limpiando el resto
  // del estado.
  function cargarImagenPlano(archivo) {
    if (esArchivoPDF(archivo)) {
      return renderizarPrimeraPaginaPDF(archivo).then((raster) => {
        setPlanoImagen({ dataUrl: raster.dataUrl, anchoPx: raster.anchoPx, altoPx: raster.altoPx, nombreArchivo: archivo.name, paginasTotal: raster.paginasTotal });
        setPlanoCalibracion(null);
        setAlturaTechoPlanoM(null);
        setNodosPlano([]);
        setSegmentosPlano([]);
        setHabitacionesPlano([]);
        setRutasConductorPlano([]);
        setMarcadoresEquipoPlano([]);
      });
    }
    return new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          setPlanoImagen({ dataUrl: e.target.result, anchoPx: img.naturalWidth, altoPx: img.naturalHeight, nombreArchivo: archivo.name });
          setPlanoCalibracion(null);
          setAlturaTechoPlanoM(null);
          setNodosPlano([]);
          setSegmentosPlano([]);
          setHabitacionesPlano([]);
          setRutasConductorPlano([]);
          setMarcadoresEquipoPlano([]);
          resolve();
        };
        img.onerror = () => reject(new Error("El archivo no es una imagen válida."));
        img.src = e.target.result;
      };
      lector.onerror = () => reject(new Error("No se pudo leer el archivo."));
      lector.readAsDataURL(archivo);
    });
  }

  function calibrarPlano(puntoImagenA, puntoImagenB, distanciaRealM) {
    const resultado = App.plano.calcularEscala(puntoImagenA, puntoImagenB, distanciaRealM);
    if (!resultado.ok) return resultado;
    setPlanoCalibracion(resultado.calibracion);
    return resultado;
  }

  /** Calibración alternativa por perímetro total (usuario, 2026-11-20) — mismo patrón que calibrarPlano, otra fuente del escalar. */
  function calibrarPlanoPorPerimetro(puntosImagenContorno, perimetroRealM) {
    const resultado = App.plano.calcularEscalaPorPerimetro(puntosImagenContorno, perimetroRealM);
    if (!resultado.ok) return resultado;
    setPlanoCalibracion(resultado.calibracion);
    return resultado;
  }

  // Convierte un punto YA en espacio imagen (píxeles) a metros reales y
  // lo registra como nodo nuevo — o reutiliza uno existente si cae
  // dentro del radio de "pegado" (ver RADIO_SNAP_METROS), para que
  // cerrar un polígono comparta el mismo nodo en vez de superponer dos.
  // Devuelve el nodo usado (nuevo o reusado) para que quien llama (el
  // hook de interacción del canvas) pueda encadenar el segmento.
  //
  // nodosPlanoRef: espejo mutable de nodosPlano, sincronizado en cada
  // render. Hace falta porque "aceptar una pared candidata sugerida"
  // llama esta función DOS veces en el mismo evento (un nodo por
  // extremo) — si la segunda lectura usara el nodosPlano del closure
  // (el de ANTES de la primera llamada, ya que setState todavía no
  // re-renderizó), el segundo setNodosPlano pisaría al primero y se
  // perdería ese nodo. Mutar el ref en el momento mismo de crear el
  // nodo mantiene ambas llamadas, dentro del mismo tick, viendo el
  // resultado real de la anterior.
  const nodosPlanoRef = useRef(nodosPlano);
  nodosPlanoRef.current = nodosPlano;

  // Deshacer / Restablecer (usuario, 2026-11-25: "hace falta dos
  // botones importantes en plano, el de restablecer y regresar de una
  // acción"). Pila de snapshots del trazado (nodos/segmentos/
  // habitaciones/rutas/marcadores) — NO incluye planoImagen/
  // planoCalibracion/alturaTechoPlanoM (cargar otra imagen o
  // recalibrar son acciones deliberadas y raras, no un "me equivoqué
  // de click"; deshacerlas queda fuera de este alcance). Guardar un
  // snapshot es barato: los arrays nunca se mutan in-place en este
  // archivo (siempre setX([...spread]) o .map/.filter), así que un
  // snapshot es solo guardar las referencias actuales, no clonar nada.
  //
  // Cada función que MUTA alguna de estas 5 piezas de estado de forma
  // ESTRUCTURAL (crear/borrar/medir — una sola acción discreta por
  // click) llama guardarPuntoDeshacerPlano() justo antes de mutar, con
  // dos tipos de excepción deliberada:
  //   - moverHabitacionPlano/moverMarcadorEquipoPlano: arrastre
  //     continuo, se llaman una vez POR EVENTO de puntero durante un
  //     solo gesto; snapshotear en cada una deshacería solo el último
  //     pixel movido, no el arrastre completo. El snapshot se guarda
  //     UNA vez al INICIO del arrastre vía iniciarArrastrePlano(),
  //     llamado desde PlanoCanvas.jsx en el pointerdown.
  //   - Edición de TEXTO libre (renombrar ambiente/ruta, altura,
  //     nombre de un marcador): dispara por cada tecla tipeada — si
  //     cada una guardara un punto de deshacer, "Deshacer" solo
  //     revertiría UN CARÁCTER a la vez. Esas funciones no participan
  //     del historial a propósito (deshacer un nombre mal tipeado se
  //     corrige escribiendo de nuevo, no con el botón de deshacer).
  //
  // Caso conocido sin resolver del todo: "aceptar pared candidata"
  // llama agregarNodoPlano DOS veces en el mismo tick (ver nota de
  // nodosPlanoRef arriba) — cada llamada guarda su propio punto de
  // deshacer, así que esa UNA acción visible puede necesitar deshacer
  // dos veces para revertirse del todo. Aceptable: nunca se pierde
  // nada ni se corrompe el historial, solo un click de más ocasional.
  const historialPlanoRef = useRef([]);
  const LIMITE_HISTORIAL_PLANO = 50;
  const [puedeDeshacerPlano, setPuedeDeshacerPlano] = useState(false);

  function guardarPuntoDeshacerPlano() {
    historialPlanoRef.current = [
      ...historialPlanoRef.current.slice(-(LIMITE_HISTORIAL_PLANO - 1)),
      {
        nodosPlano: nodosPlanoRef.current,
        segmentosPlano,
        habitacionesPlano,
        rutasConductorPlano,
        marcadoresEquipoPlano,
      },
    ];
    setPuedeDeshacerPlano(true);
  }

  function iniciarArrastrePlano() {
    guardarPuntoDeshacerPlano();
  }

  function deshacerPlano() {
    const historial = historialPlanoRef.current;
    if (historial.length === 0) return;
    const anterior = historial[historial.length - 1];
    historialPlanoRef.current = historial.slice(0, -1);
    setPuedeDeshacerPlano(historialPlanoRef.current.length > 0);
    setNodosPlano(anterior.nodosPlano);
    setSegmentosPlano(anterior.segmentosPlano);
    setHabitacionesPlano(anterior.habitacionesPlano);
    setRutasConductorPlano(anterior.rutasConductorPlano);
    setMarcadoresEquipoPlano(anterior.marcadoresEquipoPlano);
  }

  // "Restablecer" (usuario, 2026-11-25) — limpia el trazado (nodos,
  // paredes, ambientes, rutas, equipos) para volver a empezar SIN
  // perder la imagen/calibración ya cargada (distinto de "× Quitar",
  // que borra todo, imagen incluida, y obliga a recalibrar). Guarda un
  // punto de deshacer ANTES de limpiar, así un "Deshacer" inmediato
  // después de un "Restablecer" por error trae todo de vuelta.
  function restablecerPlano() {
    guardarPuntoDeshacerPlano();
    setNodosPlano([]);
    setSegmentosPlano([]);
    setHabitacionesPlano([]);
    setRutasConductorPlano([]);
    setMarcadoresEquipoPlano([]);
  }
  // `pegarAEquipo` (usuario, 2026-11-22, "pegar una ruta de conductor a
  // la posición EXACTA de un equipo marcado" — el último de los 3
  // puntos diferidos de PLANO_INTELIGENTE_DISENO.md §12): al trazar un
  // CONDUCTOR (no una pared — un equipo no pinta nada en una pared),
  // si el click cae cerca de un marcador de equipo (no de un nodo ya
  // existente, eso sigue mandando primero) el nodo nuevo se crea EN EL
  // PUNTO EXACTO del marcador, no en el click aproximado — para que la
  // ruta termine pixel-perfecta en el símbolo del equipo, no "cerca".
  // `nodoCercano` ya es genérico sobre cualquier `{punto}` (mismo que
  // usa la triangulación para mezclar nodos+marcadores como
  // referencia) — acá no hace falta mezclarlos, un marcador nunca
  // reemplaza a un nodo real (la ruta sigue guardando `nodoIds`, no
  // `marcadorId`), solo presta su punto exacto para el nodo nuevo.
  function agregarNodoPlano(puntoImagen, pegarAEquipo = false) {
    if (!planoCalibracion) return null;
    const puntoModelo = App.plano.imagenAModelo(puntoImagen, planoCalibracion.escalaMetrosPorPixel);
    const existente = App.plano.nodoCercano(puntoModelo, nodosPlanoRef.current);
    if (existente) return existente;
    const marcadorCercano = pegarAEquipo ? App.plano.nodoCercano(puntoModelo, marcadoresEquipoPlano) : null;
    const nodo = App.plano.crearNodo(marcadorCercano ? marcadorCercano.punto : puntoModelo);
    guardarPuntoDeshacerPlano();
    nodosPlanoRef.current = [...nodosPlanoRef.current, nodo];
    setNodosPlano(nodosPlanoRef.current);
    return nodo;
  }

  function agregarSegmentoPlano(nodoAId, nodoBId, tipo = "pared") {
    if (nodoAId === nodoBId) return;
    const yaExiste = segmentosPlano.some(
      (s) => (s.nodoAId === nodoAId && s.nodoBId === nodoBId) || (s.nodoAId === nodoBId && s.nodoBId === nodoAId)
    );
    if (yaExiste) return;
    guardarPuntoDeshacerPlano();
    setSegmentosPlano([...segmentosPlano, App.plano.crearSegmento(nodoAId, nodoBId, tipo)]);
  }

  function eliminarNodoPlano(nodoId) {
    guardarPuntoDeshacerPlano();
    const resultado = App.plano.eliminarNodo(nodoId, nodosPlano, segmentosPlano, habitacionesPlano, rutasConductorPlano);
    setNodosPlano(resultado.nodos);
    setSegmentosPlano(resultado.segmentos);
    setHabitacionesPlano(resultado.habitaciones);
    setRutasConductorPlano(resultado.rutasConductor);
  }

  function eliminarSegmentoPlano(segmentoId) {
    guardarPuntoDeshacerPlano();
    setSegmentosPlano(App.plano.eliminarSegmento(segmentoId, segmentosPlano));
  }

  function editarSegmentoPlano(segmentoId, cambios) {
    const segmento = segmentosPlano.find((s) => s.id === segmentoId);
    if (!segmento) return;
    guardarPuntoDeshacerPlano();
    setSegmentosPlano(segmentosPlano.map((s) => (s.id === segmentoId ? App.plano.editarSegmento(segmento, cambios) : s)));
  }

  // Registra una habitación a partir de una cadena de nodos YA cerrada
  // (el trazo volvió a su propio nodo de inicio) — ver la nota de Fase
  // 1 en modules/plano/index.js sobre por qué no es detección
  // arbitraria de ciclos.
  function cerrarHabitacionPlano(nodoIds, nombre = "") {
    const habitacion = App.plano.crearHabitacion(nodoIds, nodosPlano, nombre);
    if (!habitacion) return null;
    guardarPuntoDeshacerPlano();
    setHabitacionesPlano([...habitacionesPlano, habitacion]);
    return habitacion;
  }

  // Generalización de cerrarHabitacionPlano (deuda técnica del README,
  // "Detección de habitaciones limitada a lazos que cierran sobre su
  // propio punto de inicio" — usuario, 2026-11-25): analiza TODO el
  // grafo de paredes ya trazado y registra como ambiente CADA cara
  // cerrada que encuentre (App.plano.detectarCaras — ver su propia
  // nota de cabecera para el porqué del algoritmo), no solo la que el
  // usuario trazó volviendo a mano a su punto de partida. Así, una
  // pared interior que separa dos cuartos ya alcanza para que AMBOS
  // se detecten solos, sin retrazar los tramos compartidos.
  // Deduplica contra habitaciones YA registradas por el mismo conjunto
  // de nodos (sin importar el orden/sentido del recorrido) — nunca
  // crea un duplicado de un ambiente que el usuario ya cerró a mano o
  // ya detectó antes. Devuelve cuántos ambientes NUEVOS se agregaron.
  function detectarAmbientesPlano() {
    const caras = App.plano.detectarCaras(nodosPlano, segmentosPlano);
    const clave = (nodoIds) => [...nodoIds].sort().join(",");
    const existentes = new Set(habitacionesPlano.map((h) => clave(h.nodoIds)));
    const nuevas = [];
    for (const cara of caras) {
      const k = clave(cara.nodoIds);
      if (existentes.has(k)) continue;
      existentes.add(k); // una misma cara no puede repetirse dos veces en `caras`, pero por las dudas
      const habitacion = App.plano.crearHabitacion(cara.nodoIds, nodosPlano, `Ambiente ${habitacionesPlano.length + nuevas.length + 1}`);
      if (habitacion) nuevas.push(habitacion);
    }
    if (nuevas.length === 0) return 0;
    guardarPuntoDeshacerPlano();
    setHabitacionesPlano([...habitacionesPlano, ...nuevas]);
    return nuevas.length;
  }

  function eliminarHabitacionPlano(habitacionId) {
    guardarPuntoDeshacerPlano();
    setHabitacionesPlano(habitacionesPlano.filter((h) => h.id !== habitacionId));
  }

  function renombrarHabitacionPlano(habitacionId, nombre) {
    setHabitacionesPlano(habitacionesPlano.map((h) => (h.id === habitacionId ? { ...h, nombre: nombre.trim() || "Ambiente sin nombre" } : h)));
  }

  // "" vacío = vuelve a usar la altura general del plano (alturaTechoPlanoM).
  // El guard es `>= 0` (no `> 0`) a propósito: un 0 de paso mientras se
  // tipea un decimal (ej. "0" antes de "0.5") no debe rechazarse, nada
  // calcula todavía con este valor así que no hay riesgo real.
  function editarAlturaHabitacionPlano(habitacionId, alturaTexto) {
    const texto = String(alturaTexto).trim();
    if (texto === "") {
      setHabitacionesPlano(habitacionesPlano.map((h) => (h.id === habitacionId ? { ...h, alturaM: null } : h)));
      return;
    }
    const valor = parseFloat(texto);
    if (!(valor >= 0)) return;
    setHabitacionesPlano(habitacionesPlano.map((h) => (h.id === habitacionId ? { ...h, alturaM: valor } : h)));
  }

  // Interior/exterior (usuario, 2026-11-25) — marca el ambiente, no una
  // jerarquía nueva de terreno/edificación (ver la nota en tipos.ts).
  // Un equipo colocado adentro hereda la condición al leerla (ver
  // habitacionQueContiene), no se copia a cada marcador.
  function editarExteriorHabitacionPlano(habitacionId, exterior) {
    guardarPuntoDeshacerPlano();
    setHabitacionesPlano(habitacionesPlano.map((h) => (h.id === habitacionId ? { ...h, exterior: Boolean(exterior) } : h)));
  }

  // Tipo de ambiente (baño/cocina/garaje/...) — usuario, 2026-11-25/26,
  // para saber dónde exige GFCI el NEC (ver modules/plano/proteccionGFCI.ts
  // y advertenciasGFCI más abajo). Mismo criterio que editarExteriorHabitacionPlano.
  function editarTipoAmbienteHabitacionPlano(habitacionId, tipoAmbiente) {
    guardarPuntoDeshacerPlano();
    setHabitacionesPlano(habitacionesPlano.map((h) => (h.id === habitacionId ? { ...h, tipoAmbiente } : h)));
  }

  function establecerAlturaTechoPlano(alturaTexto) {
    const texto = String(alturaTexto).trim();
    if (texto === "") {
      setAlturaTechoPlanoM(null);
      return;
    }
    const valor = parseFloat(texto);
    if (!(valor >= 0)) return;
    setAlturaTechoPlanoM(valor);
  }

  // Generador de ambiente por dimensión conocida (2026-11-20) — el
  // usuario hace click en dónde quiere el CENTRO del ambiente y acá se
  // arma un rectángulo de anchoM×altoM exacto (4 nodos + 4 paredes +
  // la habitación), con el mismo mecanismo de siempre (ver la nota
  // larga en modules/plano/index.js). `puntoImagen` sigue el mismo
  // contrato que agregarNodoPlano: ya viene en espacio imagen, se
  // convierte acá con la calibración vigente.
  function generarHabitacionPlano(puntoImagen, nombre, anchoM, altoM) {
    if (!planoCalibracion) return null;
    const centroModelo = App.plano.imagenAModelo(puntoImagen, planoCalibracion.escalaMetrosPorPixel);
    const resultado = App.plano.crearHabitacionRectangular(centroModelo, anchoM, altoM, nombre);
    if (!resultado) return null;
    guardarPuntoDeshacerPlano();
    setNodosPlano([...nodosPlano, ...resultado.nodos]);
    setSegmentosPlano([...segmentosPlano, ...resultado.segmentos]);
    setHabitacionesPlano([...habitacionesPlano, resultado.habitacion]);
    return resultado.habitacion;
  }

  // Generador de ambiente por ARRASTRE (usuario, 2026-11-23: "hacemos
  // click y estiramos un polígono... click en una esquina... estiramos
  // hacia la otra esquina") — tercera forma de crear un rectángulo,
  // junto al trazado manual punto por punto y "Generar ambiente" por
  // medida ya conocida: acá ni se tipea la medida ni se traza punto a
  // punto, se define visualmente arrastrando sobre la imagen. Ambos
  // puntos llegan en espacio IMAGEN (mismo contrato que
  // agregarNodoPlano/generarHabitacionPlano) — se convierten a metros
  // acá y se arma el rectángulo con la MISMA fábrica que la versión
  // por medida conocida (crearHabitacionRectangular), nunca una
  // geometría paralela.
  function generarHabitacionPorArrastre(puntoImagenA, puntoImagenB, nombre) {
    if (!planoCalibracion) return null;
    const a = App.plano.imagenAModelo(puntoImagenA, planoCalibracion.escalaMetrosPorPixel);
    const b = App.plano.imagenAModelo(puntoImagenB, planoCalibracion.escalaMetrosPorPixel);
    const anchoM = Math.abs(b.x - a.x);
    const altoM = Math.abs(b.y - a.y);
    // Arrastre casi nulo (un click sin mover, o un temblor de mano) —
    // no genera un ambiente de medida absurda, se ignora en silencio.
    if (!(anchoM > 0.05) || !(altoM > 0.05)) return null;
    const centroModelo = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const resultado = App.plano.crearHabitacionRectangular(centroModelo, anchoM, altoM, nombre);
    if (!resultado) return null;
    guardarPuntoDeshacerPlano();
    setNodosPlano([...nodosPlano, ...resultado.nodos]);
    setSegmentosPlano([...segmentosPlano, ...resultado.segmentos]);
    setHabitacionesPlano([...habitacionesPlano, resultado.habitacion]);
    return resultado.habitacion;
  }

  // Arrastrar un ambiente entero (ver modo "Mover ambiente" en
  // PlanoCanvas.jsx) — `deltaM` ya viene en metros, calculado por el
  // canvas a partir del movimiento del puntero (el hook no sabe nada
  // de píxeles de pantalla ni de zoom, ver la nota de arquitectura en
  // modules/plano/coordenadas.js).
  // `conEnganche` (usuario, 2026-11-25, deuda dejada a propósito al
  // construir "plano sin imagen" v1): engancha el ambiente arrastrado
  // contra los demás ambientes y el marco del plano (real o sintético)
  // cuando algún borde queda a menos de RADIO_SNAP_METROS — ver
  // modules/plano/enganchePuzzle.ts para la mecánica completa. El
  // instalador puede apagarlo (checkbox en PlanoInteligente.jsx) si
  // molesta sobre un plano con ambientes irregulares (el enganche usa
  // la CAJA envolvente de cada ambiente, no su forma exacta).
  function moverHabitacionPlano(habitacionId, deltaM, conEnganche = true) {
    const habitacion = habitacionesPlano.find((h) => h.id === habitacionId);
    if (!habitacion) return;
    if (!conEnganche) {
      setNodosPlano(App.plano.moverNodos(habitacion.nodoIds, deltaM, nodosPlano));
      return;
    }

    const cajaActual = App.plano.cajaDeHabitacion(habitacion, nodosPlano);
    if (!cajaActual) {
      setNodosPlano(App.plano.moverNodos(habitacion.nodoIds, deltaM, nodosPlano));
      return;
    }

    const cajasReferencia = habitacionesPlano
      .filter((h) => h.id !== habitacionId)
      .map((h) => App.plano.cajaDeHabitacion(h, nodosPlano))
      .filter(Boolean);

    if (planoImagen && planoCalibracion) {
      cajasReferencia.push({
        xMin: 0,
        xMax: planoImagen.anchoPx * planoCalibracion.escalaMetrosPorPixel,
        yMin: 0,
        yMax: planoImagen.altoPx * planoCalibracion.escalaMetrosPorPixel,
      });
    }

    const deltaConEnganche = App.plano.calcularDeltaConEnganche(cajaActual, deltaM, cajasReferencia, App.plano.RADIO_SNAP_METROS);
    setNodosPlano(App.plano.moverNodos(habitacion.nodoIds, deltaConEnganche, nodosPlano));
  }

  // Registra una ruta de conductor a partir de una cadena de nodos YA
  // trazada como segmentos tipo "conductor" (mismo mecanismo de
  // trazado/pegado que las paredes — ver agregarSegmentoPlano con
  // tipo="conductor"). No se cierra en lazo: es punto a punto.
  function cerrarRutaConductorPlano(nodoIds, nombre = "") {
    const ruta = App.plano.crearRutaConductor(nodoIds, nodosPlano, nombre);
    if (!ruta) return null;
    guardarPuntoDeshacerPlano();
    setRutasConductorPlano([...rutasConductorPlano, ruta]);
    return ruta;
  }

  function eliminarRutaConductorPlano(rutaId) {
    guardarPuntoDeshacerPlano();
    setRutasConductorPlano(App.plano.eliminarRutaConductor(rutaId, rutasConductorPlano));
  }

  function renombrarRutaConductorPlano(rutaId, nombre) {
    setRutasConductorPlano(rutasConductorPlano.map((r) => (r.id === rutaId ? { ...r, nombre: nombre.trim() || "Ruta sin nombre" } : r)));
  }

  // Vínculo de una ruta a un circuito/tablero (usuario, 2026-11-22,
  // "autocompletar la distancia del circuito/alimentador desde la
  // longitud ya trazada en el plano") + la acción de copiar esa
  // longitud al campo real — UNA sola vez por click, no un sincronizado
  // permanente (el campo sigue siendo la fuente editable de siempre,
  // igual que antes de vincular nada).
  function vincularRutaConductorPlano(rutaId, entidadId, entidadTipo) {
    guardarPuntoDeshacerPlano();
    setRutasConductorPlano(
      rutasConductorPlano.map((r) => (r.id === rutaId ? App.plano.vincularRutaConductor(r, entidadId, entidadTipo) : r))
    );
  }

  // "Sugerir ruta automática" (usuario, 2026-11-25, pensado como una
  // instalación real: calibrar → ubicar cajas de empalme → trazar la
  // red de rutas permitida → el resto se conecta solo arrastrando los
  // circuitos ya vinculados). v1, opción acordada con el usuario:
  // arranca desde el marcador del TABLERO del circuito — NO desde una
  // caja de empalme, que sigue sin vincularse a nada (decisión ya
  // tomada, ver bibliotecaComponentes.js) — hacia cada equipo del
  // circuito que YA tenga marcador, buscando el camino más corto SOLO
  // sobre los segmentos "conductor" ya trazados a mano con "Trazar
  // conductor" (App.plano.caminoMasCorto) — "la red" no es un concepto
  // nuevo, es la que ya existe una vez que se trazó. Genera una
  // RutaConductorPlano por cada equipo alcanzable, SIN vincular a nada
  // por default — igual que una ruta trazada a mano, el usuario decide
  // después (con "Vincular a" + "Usar esta longitud") cuál de todas
  // representa la distancia real del circuito. Nunca inventa una
  // conexión recta: un equipo sin camino en la red ya trazada, o sin
  // marcador todavía, se reporta aparte, no se conecta a la fuerza.
  // Deduplica contra rutas YA registradas con el MISMO camino exacto
  // (mismo conjunto de nodos, sin importar sentido) — correr esta
  // acción de nuevo sobre el mismo circuito no genera duplicados.
  // `origenMarcadorId` (usuario, 2026-11-26, retomando el punto dejado
  // pendiente a propósito el 2026-11-24: "...y sea el punto de
  // arranque real"): opcional, el id de un marcador "caja_empalme" ya
  // colocado — una instalación real a menudo NO sale directo del
  // tablero a cada equipo, sale del tablero a una caja principal y de
  // ahí se reparte. Sigue sin ser un concepto eléctrico (la caja NUNCA
  // se vincula a nada) — es solo CUÁL nodo de la red ya trazada usar
  // como punto de partida del camino más corto. Sin este parámetro
  // (default null), el comportamiento es EXACTAMENTE el de siempre:
  // arranca del marcador del tablero del circuito.
  function generarRutasAutomaticasCircuito(circuitoId, origenMarcadorId = null) {
    const circuito = circuitos.find((c) => c.id === circuitoId);
    if (!circuito) return null;

    const nodoCercaDe = (punto) => App.plano.nodoCercano(punto, nodosPlano, App.plano.RADIO_SNAP_METROS);

    let marcadorOrigen;
    if (origenMarcadorId) {
      marcadorOrigen = marcadoresEquipoPlano.find((m) => m.id === origenMarcadorId && m.tipo === "caja_empalme");
      if (!marcadorOrigen) return { generadas: [], sinTablero: false, sinOrigen: true, sinCamino: [] };
    } else {
      marcadorOrigen = circuito.tableroId ? marcadoresEquipoPlano.find((m) => m.tipo === "tablero_electrico" && m.entidadId === circuito.tableroId) : null;
      if (!marcadorOrigen) return { generadas: [], sinTablero: true, sinCamino: [] };
    }

    const nodoOrigen = nodoCercaDe(marcadorOrigen.punto);
    const nombreOrigen = marcadorOrigen.nombre || (origenMarcadorId ? "Caja de empalme" : "Tablero");
    const clave = (nodoIds) => [...nodoIds].sort().join(",");
    const existentes = new Set(rutasConductorPlano.map((r) => clave(r.nodoIds)));

    const equiposDelCircuito = equipos.filter((e) => e.circuitoId === circuitoId);
    const sinCamino = [];
    const nuevasRutas = [];

    for (const equipo of equiposDelCircuito) {
      const marcadorEquipo = marcadoresEquipoPlano.find((m) => m.entidadId === equipo.id);
      const nodoEquipo = marcadorEquipo ? nodoCercaDe(marcadorEquipo.punto) : null;
      const camino = nodoOrigen && nodoEquipo ? App.plano.caminoMasCorto(nodoOrigen.id, nodoEquipo.id, nodosPlano, segmentosPlano) : null;
      if (!camino) {
        sinCamino.push(equipo.nombre || "Equipo sin nombre");
        continue;
      }
      if (existentes.has(clave(camino.nodoIds))) continue; // ya existe una ruta con este mismo camino — no duplicar
      const ruta = App.plano.crearRutaConductor(camino.nodoIds, nodosPlano, `Auto: ${nombreOrigen} → ${equipo.nombre || "Equipo"}`);
      if (ruta) nuevasRutas.push(ruta);
    }

    if (nuevasRutas.length > 0) {
      guardarPuntoDeshacerPlano();
      setRutasConductorPlano([...rutasConductorPlano, ...nuevasRutas]);
    }
    return { generadas: nuevasRutas, sinTablero: false, sinCamino };
  }

  function actualizarDistanciaCircuito(id, distanciaM) {
    setCircuitos(circuitos.map((c) => (c.id === id ? { ...c, distancia: distanciaM } : c)));
  }

  /**
   * Copia la longitud YA calculada (trazado + cruces de pared +, si
   * corresponde, la bajada/subida real hasta el equipo del extremo —
   * ver modules/plano/alturaInstalacion.ts) de una ruta vinculada al
   * campo real del circuito/tablero que señala. No hace nada si la
   * ruta no está vinculada.
   */
  function aplicarLongitudRutaPlano(rutaId) {
    const ruta = rutasConductorPlano.find((r) => r.id === rutaId);
    if (!ruta?.entidadId) return;
    const segmentosPared = segmentosPlano.filter((s) => s.tipo === "pared");
    const { longitudTotalConAlturaM } = App.plano.calcularLongitudEsperadaRuta(
      ruta,
      nodosPlano,
      segmentosPared,
      marcadoresEquipoPlano,
      equipos,
      habitacionesPlano,
      alturaTechoPlanoM
    );
    // Redondeado a cm (2 decimales) — la precisión de más de la resta
    // de puntos en metros no aporta nada real (ni la escala calibrada
    // a mano ni la medida de espesor tienen esa exactitud) y ensucia
    // el campo si el instalador lo ve/edita después.
    const distanciaRedondeada = Math.round(longitudTotalConAlturaM * 100) / 100;
    if (ruta.entidadTipo === "circuito") {
      actualizarDistanciaCircuito(ruta.entidadId, distanciaRedondeada);
    } else if (ruta.entidadTipo === "tablero") {
      editarTablero(ruta.entidadId, { longitudAlimentador: distanciaRedondeada });
    }
  }

  // Marcadores de equipo — puntos independientes del grafo de
  // nodos/segmentos (ver nota de arquitectura en modules/plano/index.js).
  function agregarMarcadorEquipoPlano(puntoImagen, tipo, entidadId = null, nombre = "") {
    if (!planoCalibracion) return null;
    const puntoModelo = App.plano.imagenAModelo(puntoImagen, planoCalibracion.escalaMetrosPorPixel);
    const marcador = App.plano.crearMarcadorEquipo(puntoModelo, tipo, entidadId, nombre);
    guardarPuntoDeshacerPlano();
    setMarcadoresEquipoPlano([...marcadoresEquipoPlano, marcador]);
    return marcador;
  }

  function editarMarcadorEquipoPlano(marcadorId, cambios) {
    setMarcadoresEquipoPlano(
      marcadoresEquipoPlano.map((m) => (m.id === marcadorId ? App.plano.editarMarcadorEquipo(m, cambios) : m))
    );
  }

  // "Mover equipo" (usuario, 2026-11-24) — hasta ahora un marcador de
  // equipo, una vez colocado, solo se podía borrar y volver a crear
  // para reubicarlo (ver "Mover ambiente", que sí existía para
  // habitaciones pero no para equipos). deltaM ya viene en METROS
  // (espacio modelo) — mismo contrato que moverHabitacionPlano.
  function moverMarcadorEquipoPlano(marcadorId, deltaM) {
    const marcador = marcadoresEquipoPlano.find((m) => m.id === marcadorId);
    if (!marcador) return;
    const puntoNuevo = { x: marcador.punto.x + deltaM.x, y: marcador.punto.y + deltaM.y };
    setMarcadoresEquipoPlano(
      marcadoresEquipoPlano.map((m) => (m.id === marcadorId ? App.plano.editarMarcadorEquipo(m, { punto: puntoNuevo }) : m))
    );
  }

  // "Generar grupo" (usuario, 2026-11-24: "elegí la cantidad de
  // interruptores y luces que quiere, genera un grupo con esa cantidad
  // de equipo que puedes mover a placer, además se puede numerar y
  // etiquetar") — crea VARIOS marcadores del mismo tipo de una vez, en
  // vez de repetir "Colocar equipo" uno por uno. Arrancan apilados en
  // diagonal cerca del click (para que cada uno sea clickeable de
  // entrada, no exactamente superpuestos) — el usuario los arrastra
  // después a su posición real con "Mover equipo". Numerados en el
  // nombre ("Luz 1", "Luz 2"...) para que sean distinguibles de
  // entrada; renombrables igual que cualquier marcador ya existente.
  const SEPARACION_GRUPO_PX = 18;
  const CANTIDAD_MAXIMA_GRUPO = 50;
  function generarGrupoMarcadoresEquipoPlano(puntoImagen, tipo, cantidad, nombreBase = "") {
    if (!planoCalibracion) return null;
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > CANTIDAD_MAXIMA_GRUPO) return null;
    const comp = App.plano.obtenerComponente(tipo);
    const base = nombreBase.trim() || comp?.nombre || "Equipo";
    const nuevos = [];
    for (let i = 1; i <= cantidad; i++) {
      const puntoImagenI = { x: puntoImagen.x + i * SEPARACION_GRUPO_PX, y: puntoImagen.y + i * SEPARACION_GRUPO_PX };
      const puntoModelo = App.plano.imagenAModelo(puntoImagenI, planoCalibracion.escalaMetrosPorPixel);
      nuevos.push(App.plano.crearMarcadorEquipo(puntoModelo, tipo, null, `${base} ${i}`));
    }
    guardarPuntoDeshacerPlano();
    setMarcadoresEquipoPlano([...marcadoresEquipoPlano, ...nuevos]);
    return nuevos;
  }

  // "Generar circuito completo" (usuario, 2026-11-25: "desde el
  // diagrama unifilar se puede generar el circuito completo con sus
  // consumidores finales solo para arrastrar dentro del plano ya con
  // sus id ya vinculado") — mismo patrón visual de apilado que
  // "Generar grupo" (arriba), pero en vez de N marcadores NUEVOS de un
  // mismo tipo elegido a mano, toma TODOS los equipos YA cargados de
  // un circuito real y genera un marcador por cada uno, cada uno YA
  // vinculado a su propio equipo (entidadId) y con su símbolo inferido
  // solo (App.diagrama.elegirSimboloEquipo, misma heurística que
  // "¿Equipo ya ingresado?" de "Colocar equipo") — el usuario solo
  // arrastra cada uno a su posición real con "Mover equipo", sin
  // vincular nada a mano. Un equipo del circuito que YA tenga marcador
  // en el plano (de una ronda anterior) se salta, nunca se duplica —
  // mismo criterio de exclusión que "¿Equipo ya ingresado?".
  function generarCircuitoMarcadoresEquipoPlano(puntoImagen, circuitoId) {
    if (!planoCalibracion) return null;
    const circuito = circuitos.find((c) => c.id === circuitoId);
    if (!circuito) return { nuevos: [], total: 0 };
    const equiposDelCircuito = equipos.filter((e) => e.circuitoId === circuitoId);
    const yaVinculados = new Set(marcadoresEquipoPlano.map((m) => m.entidadId).filter(Boolean));
    const pendientes = equiposDelCircuito.filter((e) => !yaVinculados.has(e.id));
    // El propio circuito (PIA, usuario, 2026-11-25: "la representación
    // de los circuitos en sí... que realmente quiero mover en el
    // plano") se genera junto con sus equipos — un marcador propio,
    // vinculado al circuito (no a un equipo), de una sola vez. Se
    // salta si el circuito YA tiene marcador (mismo criterio de
    // dedup que el resto de esta función).
    const circuitoYaTieneMarcador = yaVinculados.has(circuitoId);
    if (pendientes.length === 0 && circuitoYaTieneMarcador) {
      return { nuevos: [], circuitoGenerado: false, total: equiposDelCircuito.length };
    }

    const nuevosEquipos = [];
    let circuitoGenerado = false;
    const nuevos = [];
    if (!circuitoYaTieneMarcador) {
      const puntoModeloCircuito = App.plano.imagenAModelo(puntoImagen, planoCalibracion.escalaMetrosPorPixel);
      nuevos.push(App.plano.crearMarcadorEquipo(puntoModeloCircuito, "circuito", circuito.id, circuito.nombre || ""));
      circuitoGenerado = true;
    }
    pendientes.forEach((equipo, i) => {
      const puntoImagenI = { x: puntoImagen.x + (i + 1) * SEPARACION_GRUPO_PX, y: puntoImagen.y + (i + 1) * SEPARACION_GRUPO_PX };
      const puntoModelo = App.plano.imagenAModelo(puntoImagenI, planoCalibracion.escalaMetrosPorPixel);
      const tipo = App.diagrama.elegirSimboloEquipo(equipo);
      const marcador = App.plano.crearMarcadorEquipo(puntoModelo, tipo, equipo.id, equipo.nombre || "");
      nuevos.push(marcador);
      nuevosEquipos.push(marcador);
    });
    guardarPuntoDeshacerPlano();
    setMarcadoresEquipoPlano([...marcadoresEquipoPlano, ...nuevos]);
    return { nuevos: nuevosEquipos, circuitoGenerado, total: equiposDelCircuito.length };
  }

  function eliminarMarcadorEquipoPlano(marcadorId) {
    guardarPuntoDeshacerPlano();
    setMarcadoresEquipoPlano(App.plano.eliminarMarcadorEquipo(marcadorId, marcadoresEquipoPlano));
  }

  function quitarImagenPlano() {
    setPlanoImagen(null);
    setPlanoCalibracion(null);
    setAlturaTechoPlanoM(null);
    setNodosPlano([]);
    setSegmentosPlano([]);
    setHabitacionesPlano([]);
    setRutasConductorPlano([]);
    setMarcadoresEquipoPlano([]);
  }

  // Corrección de perspectiva (Fase 2, 2do pedido) — ver
  // modules/plano/homografia.js para el porqué. PX_POR_METRO_RECTIFICADO
  // es una constante FIJA, igual criterio que DPI_REFERENCIA en
  // shared/utils/pdfARaster.ts: no depende del dispositivo, así que la
  // imagen rectificada (y su escala) sale igual en cualquier lado.
  //
  // Como el rectángulo destino se define con un tamaño real conocido
  // (anchoRealM × altoRealM), la imagen YA sale calibrada — no hace
  // falta que el usuario repita la calibración de 2 puntos después
  // (aunque la puede rehacer si quiere, "Recalibrar" sigue ahí).
  const PX_POR_METRO_RECTIFICADO = 120;

  // "Plano sin imagen" (usuario, 2026-11-24: "muchas instalaciones no
  // tiene plano... primero ingresado la área total de la casa que
  // sería como el marco del rompecabezas") — en vez de pedir un
  // número de área suelto (no alcanza para definir una forma: un
  // mismo m² admite infinitos rectángulos), se pide ancho×alto reales
  // del marco, igual criterio que "Generar ambiente" (que ya existe,
  // mismo patrón de nombre+ancho+alto). El "marco" acá es sencillamente
  // una imagen de fondo SINTÉTICA (un rectángulo liso, sin foto real
  // detrás) del tamaño exacto pedido, ya calibrada de entrada —
  // mismo PX_POR_METRO_RECTIFICADO que la corrección de perspectiva,
  // para no inventar una segunda convención de escala sintética. De
  // ahí en más es EXACTAMENTE el mismo Plano de siempre: "Generar
  // ambiente"/"Trazar rectángulo" para las piezas (habitaciones),
  // "Mover ambiente" para acomodarlas — sin enganche automático
  // todavía (confirmado con el usuario: v1 es arrastre libre, igual
  // que ya funciona; el motor de alineación para que no queden huecos
  // es una mejora aparte, a propósito no construida acá).
  function crearPlanoSinImagen(anchoM, altoM, nombre = "", alturaTechoM = null) {
    if (!(anchoM > 0) || !(altoM > 0)) return null;
    const anchoPx = Math.round(anchoM * PX_POR_METRO_RECTIFICADO);
    const altoPx = Math.round(altoM * PX_POR_METRO_RECTIFICADO);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${anchoPx}" height="${altoPx}"><rect width="100%" height="100%" fill="#f1ede6" stroke="#8a8578" stroke-width="3"/></svg>`;
    setPlanoImagen({
      dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
      anchoPx,
      altoPx,
      nombreArchivo: nombre.trim() || `Plano sin imagen (${anchoM}m × ${altoM}m)`,
    });
    setPlanoCalibracion({
      puntoA: { x: 0, y: 0 },
      puntoB: { x: anchoPx, y: 0 },
      distanciaRealM: anchoM,
      escalaMetrosPorPixel: 1 / PX_POR_METRO_RECTIFICADO,
    });
    setAlturaTechoPlanoM(alturaTechoM > 0 ? alturaTechoM : null);
    setNodosPlano([]);
    setSegmentosPlano([]);
    setHabitacionesPlano([]);
    setRutasConductorPlano([]);
    setMarcadoresEquipoPlano([]);
    return { anchoM, altoM, alturaTechoM: alturaTechoM > 0 ? alturaTechoM : null };
  }

  function corregirPerspectivaPlano(puntosImagenOrigen, anchoRealM, altoRealM) {
    if (!(anchoRealM > 0) || !(altoRealM > 0)) {
      return Promise.resolve({ ok: false, motivo: "El ancho y el alto reales deben ser mayores a 0." });
    }
    const anchoDestinoPx = Math.round(anchoRealM * PX_POR_METRO_RECTIFICADO);
    const altoDestinoPx = Math.round(altoRealM * PX_POR_METRO_RECTIFICADO);
    const puntosDestino = [
      { x: 0, y: 0 },
      { x: anchoDestinoPx, y: 0 },
      { x: anchoDestinoPx, y: altoDestinoPx },
      { x: 0, y: altoDestinoPx },
    ];
    const homografia = App.plano.calcularHomografia(puntosImagenOrigen, puntosDestino);
    if (!homografia) {
      return Promise.resolve({ ok: false, motivo: "Esos 4 puntos no forman un cuadrilátero válido (¿hay varios alineados?). Probá de nuevo." });
    }
    const homografiaInversa = App.plano.invertirMatriz3x3(homografia);
    if (!homografiaInversa) {
      return Promise.resolve({ ok: false, motivo: "No se pudo invertir la transformación — probá con otros puntos." });
    }
    return rectificarImagen(planoImagen.dataUrl, homografiaInversa, anchoDestinoPx, altoDestinoPx)
      .then((resultado) => {
        setPlanoImagen({
          dataUrl: resultado.dataUrl,
          anchoPx: resultado.anchoPx,
          altoPx: resultado.altoPx,
          nombreArchivo: `${planoImagen.nombreArchivo} (perspectiva corregida)`,
        });
        setPlanoCalibracion({
          puntoA: { x: 0, y: 0 },
          puntoB: { x: anchoDestinoPx, y: 0 },
          distanciaRealM: anchoRealM,
          escalaMetrosPorPixel: 1 / PX_POR_METRO_RECTIFICADO,
        });
        setNodosPlano([]);
        setSegmentosPlano([]);
        setHabitacionesPlano([]);
        setRutasConductorPlano([]);
        setMarcadoresEquipoPlano([]);
        return { ok: true };
      })
      .catch((err) => ({ ok: false, motivo: err.message }));
  }

  // Exportación CAD (Fase 2, 2do pedido) — descarga el grafo de
  // paredes/habitaciones como .dxf (ver modules/plano/exportarDXF.js).
  // Mismo patrón de descarga que PersistenciaMediator.descargarJson.
  function exportarDXFPlano() {
    const contenido = App.plano.generarDXF({ nodos: nodosPlano, segmentos: segmentosPlano, habitaciones: habitacionesPlano });
    // Bytes de Windows-1252, NUNCA el string directo (UTF-8 por
    // defecto en un Blob) — ver la nota larga en exportarDXF.js sobre
    // por qué, si no, los acentos salen corruptos al abrir el DXF.
    const blob = new Blob([App.plano.codificarDXFComoBytes(contenido)], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = (proyecto.nombre || "plano").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    a.download = `${slug || "plano"}.dxf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- PROYECTO ---
  // Guarda como .pdf (usuario, 2026-11-22: "quiero que el empaquetado...
  // guarde en PDF en vez de json") — App.guardarProyecto ahora arma el
  // PDF (ficha legible + datos completos incrustados, ver
  // modules/persistencia/pdf.ts), por eso esta función es async.
  async function guardarProyecto() {
    const datosProyecto = {
      proyecto,
      normativaActiva,
      tipoInstalacion,
      circuitos,
      equipos,
      tableros,
      fuentesEnergia,
      transformadores,
      diferenciales,
      nodosDiagrama,
      conexionesDiagrama,
      plano: {
        imagen: planoImagen,
        calibracion: planoCalibracion,
        alturaTechoM: alturaTechoPlanoM,
        nodos: nodosPlano,
        segmentos: segmentosPlano,
        habitaciones: habitacionesPlano,
        rutasConductor: rutasConductorPlano,
        marcadoresEquipo: marcadoresEquipoPlano,
      },
    };
    try {
      const nombre = await App.guardarProyecto(datosProyecto);
      setAvisoArchivo(`Guardado como ${nombre}`);
    } catch (err) {
      setAvisoArchivo(`No se pudo guardar: ${err.message}`);
    }
    setTimeout(() => setAvisoArchivo(""), 4000);
  }

  // Guardar como .json sigue disponible (botón secundario en
  // BarraProyecto) para quien prefiera el formato de siempre.
  function guardarProyectoComoJson() {
    const nombre = App.guardarProyectoComoJson({
      proyecto,
      normativaActiva,
      tipoInstalacion,
      circuitos,
      equipos,
      tableros,
      fuentesEnergia,
      transformadores,
      diferenciales,
      nodosDiagrama,
      conexionesDiagrama,
      plano: {
        imagen: planoImagen,
        calibracion: planoCalibracion,
        alturaTechoM: alturaTechoPlanoM,
        nodos: nodosPlano,
        segmentos: segmentosPlano,
        habitaciones: habitacionesPlano,
        rutasConductor: rutasConductorPlano,
        marcadoresEquipo: marcadoresEquipoPlano,
      },
    });
    setAvisoArchivo(`Guardado como ${nombre}`);
    setTimeout(() => setAvisoArchivo(""), 4000);
  }

  function abrirProyecto(archivo) {
    App.abrirProyecto(archivo)
      .then((cargado) => {
        setProyecto(cargado.proyecto);
        setNormativaActivaBase(cargado.normativaActiva);
        setTipoInstalacion(cargado.tipoInstalacion ?? TIPO_INSTALACION_POR_DEFECTO);
        setCircuitos(cargado.circuitos);
        setEquipos(cargado.equipos);
        setTableros(cargado.tableros ?? []);
        setFuentesEnergia(cargado.fuentesEnergia ?? []);
        setTransformadores(cargado.transformadores ?? []);
        setDiferenciales(cargado.diferenciales ?? []);
        setNodosDiagrama(cargado.nodosDiagrama ?? []);
        setConexionesDiagrama(cargado.conexionesDiagrama ?? []);
        setPlanoImagen(cargado.plano?.imagen ?? null);
        setPlanoCalibracion(cargado.plano?.calibracion ?? null);
        setAlturaTechoPlanoM(cargado.plano?.alturaTechoM ?? null);
        setNodosPlano(cargado.plano?.nodos ?? []);
        setSegmentosPlano(cargado.plano?.segmentos ?? []);
        setHabitacionesPlano(cargado.plano?.habitaciones ?? []);
        setRutasConductorPlano(cargado.plano?.rutasConductor ?? []);
        setMarcadoresEquipoPlano(cargado.plano?.marcadoresEquipo ?? []);
        setCircuitoActivoId(cargado.circuitos[0]?.id ?? null);
        setAvisoArchivo(`Proyecto "${cargado.proyecto.nombre}" cargado.`);
        setTimeout(() => setAvisoArchivo(""), 5000);
      })
      .catch((err) => {
        setAvisoArchivo(`No se pudo abrir el archivo: ${err.message}`);
        setTimeout(() => setAvisoArchivo(""), 5000);
      });
  }

  function nuevoProyecto() {
    setProyecto(App.nuevoProyecto());
    setCircuitos([]);
    setEquipos([]);
    setTableros([]);
    setFuentesEnergia([]);
    setTransformadores([]);
    setDiferenciales([]);
    setNodosDiagrama([]);
    setConexionesDiagrama([]);
    setPlanoImagen(null);
    setPlanoCalibracion(null);
    setAlturaTechoPlanoM(null);
    setNodosPlano([]);
    setSegmentosPlano([]);
    setHabitacionesPlano([]);
    setRutasConductorPlano([]);
    setMarcadoresEquipoPlano([]);
    setCircuitoActivoId(null);
    setFormCircuito({ ...CIRCUITO_VACIO, etiqueta: App.etiquetado.sugerirCircuito(null, []) });
    setFormEquipo({ ...EQUIPO_VACIO, etiqueta: App.etiquetado.sugerirEquipo(null, []) });
    setEditandoCircuitoId(null);
    setEditandoEquipoId(null);
    setErrorCircuito("");
    setErrorEquipo("");
  }

  const circuitoActivo = circuitos.find((c) => c.id === circuitoActivoId) ?? null;

  return {
    proyecto,
    setProyecto,
    avisoArchivo,
    guardarProyecto,
    guardarProyectoComoJson,
    abrirProyecto,
    nuevoProyecto,
    circuitos,
    equipos,
    resultados,
    resultadosParaTabla,
    totales,
    normativaActiva,
    setNormativaActiva,
    tipoInstalacion,
    setTipoInstalacion,
    umbralDesbalanceFasesPct,
    setUmbralDesbalanceFasesPct,
    formCircuito,
    setFormCircuito,
    errorCircuito,
    editandoCircuitoId,
    circuitoActivoId,
    setCircuitoActivoId,
    circuitoActivo,
    cambiarFasesCircuito,
    guardarCircuito,
    iniciarEdicionCircuito,
    cancelarEdicionCircuito,
    eliminarCircuito,
    editarEtiquetaFuncionCircuito,
    formEquipo,
    setFormEquipo,
    errorEquipo,
    editandoEquipoId,
    guardarEquipo,
    iniciarEdicionEquipo,
    cancelarEdicionEquipo,
    eliminarEquipo,
    editarEtiquetaFuncionEquipo,
    crearCircuitoIluminacionGeneral,
    previsualizarImportacionEquipos,
    confirmarImportacionEquipos,
    confirmarImportacionProyectoPDF,
    equiposDe,
    tableros,
    crearTablero,
    editarTablero,
    eliminarTablero,
    asignarCircuitoATablero,
    asignarLineasCircuito,
    circuitosDeTablero,
    circuitosSinTablero,
    alimentadores,
    balancesFases,
    fuentesEnergia,
    crearFuenteEnergia,
    editarFuenteEnergia,
    eliminarFuenteEnergia,
    transformadores,
    crearTransformador,
    editarTransformador,
    eliminarTransformador,
    diferenciales,
    crearDiferencial,
    editarDiferencial,
    eliminarDiferencial,
    asignarCircuitoADiferencial,
    nodosDiagrama,
    crearNodoDiagrama,
    editarNodoDiagrama,
    eliminarNodoDiagrama,
    autoorganizarDiagrama,
    conexionesDiagrama,
    crearConexionDiagrama,
    editarConexionDiagrama,
    eliminarConexionDiagrama,
    planoImagen,
    cargarImagenPlano,
    quitarImagenPlano,
    restablecerPlano,
    deshacerPlano,
    puedeDeshacerPlano,
    iniciarArrastrePlano,
    planoCalibracion,
    calibrarPlano,
    calibrarPlanoPorPerimetro,
    alturaTechoPlanoM,
    establecerAlturaTechoPlano,
    nodosPlano,
    segmentosPlano,
    agregarNodoPlano,
    agregarSegmentoPlano,
    eliminarNodoPlano,
    eliminarSegmentoPlano,
    editarSegmentoPlano,
    habitacionesPlano,
    cerrarHabitacionPlano,
    detectarAmbientesPlano,
    eliminarHabitacionPlano,
    renombrarHabitacionPlano,
    editarAlturaHabitacionPlano,
    editarExteriorHabitacionPlano,
    editarTipoAmbienteHabitacionPlano,
    generarHabitacionPlano,
    generarHabitacionPorArrastre,
    moverHabitacionPlano,
    rutasConductorPlano,
    cerrarRutaConductorPlano,
    eliminarRutaConductorPlano,
    renombrarRutaConductorPlano,
    vincularRutaConductorPlano,
    generarRutasAutomaticasCircuito,
    aplicarLongitudRutaPlano,
    marcadoresEquipoPlano,
    agregarMarcadorEquipoPlano,
    editarMarcadorEquipoPlano,
    eliminarMarcadorEquipoPlano,
    moverMarcadorEquipoPlano,
    generarGrupoMarcadoresEquipoPlano,
    generarCircuitoMarcadoresEquipoPlano,
    corregirPerspectivaPlano,
    crearPlanoSinImagen,
    exportarDXFPlano,
    listaIntegridad,
    resumenIntegridad: resumenInt,
    desincronizacionRutas,
    entidadesPorCajaEmpalme,
    advertenciasGFCI,
    advertenciasAFCI,
    advertenciasVolumenBano,
    advertenciasDiferencialREBT,
    detalleElectrico,
    ESTADOS_INTEGRIDAD: App.validacion.ESTADOS,
  };
}
