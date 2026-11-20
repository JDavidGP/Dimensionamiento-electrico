/**
 * Hook de estado de la UI.
 * Toda interacción entre dominios pasa por ApplicationMediator
 * (no importa motor, normativa ni validación directamente).
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import { ApplicationMediator as App } from "../core/ApplicationMediator.js";
import { TIPO_INSTALACION_POR_DEFECTO } from "../shared/constants/constantes.js";

const { CIRCUITO_VACIO, EQUIPO_VACIO, TABLERO_VACIO } = App.data.tablas.plantillas();

export function useCircuitos() {
  const [proyecto, setProyecto] = useState(() => App.nuevoProyecto());
  const [avisoArchivo, setAvisoArchivo] = useState("");
  const [circuitos, setCircuitos] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [tableros, setTableros] = useState([]);
  const [fuentesEnergia, setFuentesEnergia] = useState([]);
  const [transformadores, setTransformadores] = useState([]);
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
  const [nodosPlano, setNodosPlano] = useState([]);
  const [segmentosPlano, setSegmentosPlano] = useState([]);
  const [habitacionesPlano, setHabitacionesPlano] = useState([]);
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

  // Cálculo vía MotorCalculoMediator
  const resultados = useMemo(
    () => App.motor.calcularTodos(circuitos, equipos, normativaActiva),
    [circuitos, equipos, normativaActiva]
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
      nodosDiagrama,
      conexionesDiagrama,
      normativaActiva,
      tipoInstalacion,
      resultados,
    });
  }, [proyecto, circuitos, equipos, tableros, fuentesEnergia, transformadores, nodosDiagrama, conexionesDiagrama, normativaActiva, tipoInstalacion, resultados]);

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
      });
    });
    return mapa;
  }, [tableros, circuitos, resultados, normativaActiva]);

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
  }, [resultados, circuitos, tableros, normativaActiva]);

  // Integridad vía ValidacionMediator
  const listaIntegridad = useMemo(
    () => App.validacion.listaIntegridad(proyecto, circuitos, equipos, tableros, fuentesEnergia, nodosDiagrama, transformadores),
    [proyecto, circuitos, equipos, tableros, fuentesEnergia, nodosDiagrama, transformadores]
  );

  const resumenInt = useMemo(
    () => App.validacion.resumen(proyecto, circuitos, equipos, tableros, fuentesEnergia, nodosDiagrama, transformadores),
    [proyecto, circuitos, equipos, tableros, fuentesEnergia, nodosDiagrama, transformadores]
  );

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
    setCircuitos(circuitos.filter((c) => c.id !== id));
    setEquipos(equipos.filter((e) => e.circuitoId !== id));
    if (circuitoActivoId === id) setCircuitoActivoId(null);
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
    setEquipos(equipos.filter((e) => e.id !== id));
    if (editandoEquipoId === id) cancelarEdicionEquipo();
  }

  function equiposDe(circuitoId) {
    return equipos.filter((e) => e.circuitoId === circuitoId);
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
    setTableros(tableros.filter((t) => t.id !== id));
  }

  // --- FUENTE DE ENERGÍA (Batería/Generador, origen alternativo de un tablero) ---
  function crearFuenteEnergia(datos) {
    const fuente = App.origen.crearFuente(datos);
    setFuentesEnergia([...fuentesEnergia, fuente]);
    return fuente;
  }

  function editarFuenteEnergia(id, cambios) {
    const fuente = fuentesEnergia.find((f) => f.id === id);
    if (!fuente) return;
    const actualizada = App.origen.editarFuente(fuente, cambios);
    setFuentesEnergia(fuentesEnergia.map((f) => (f.id === id ? actualizada : f)));
  }

  function eliminarFuenteEnergia(id) {
    // Libera (no rompe) los tableros que la tenían como origen y los
    // nodos del diagrama que la representaban.
    setTableros(App.origen.liberarTableros(id, tableros));
    setNodosDiagrama(App.diagrama.liberarNodosDeEntidad(id, nodosDiagrama));
    setFuentesEnergia(fuentesEnergia.filter((f) => f.id !== id));
  }

  // --- TRANSFORMADOR (origen alternativo de un tablero, solo instalaciones
  // industriales — ver tipoInstalacion arriba) ---
  // Deliberadamente solo "crear" por ahora, igual criterio que
  // fuentesEnergia tuvo al principio: "nos hace falta datos para
  // desarrollar ese apartado" (usuario, 2026-11-19) — editar/eliminar
  // (y una lista propia tipo PanelFuentesEnergia) quedan para cuando
  // haya un proyecto industrial real que lo pida, igual que pasó con
  // fuentesEnergia.
  function crearTransformador(datos) {
    const transformador = App.origen.crearTransformador(datos);
    setTransformadores([...transformadores, transformador]);
    return transformador;
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

  // --- PLANO INTELIGENTE (Fase 1) ---
  // Carga el archivo de imagen como data URL (embebida en el proyecto,
  // ver la nota en modules/persistencia/proyecto.js sobre por qué).
  // Al cargar una imagen NUEVA se resetea todo lo demás del plano
  // (calibración/nodos/segmentos/habitaciones no tendrían sentido
  // sobre un fondo distinto) — mismo criterio que nuevoProyecto()
  // limpiando el resto del estado.
  function cargarImagenPlano(archivo) {
    return new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          setPlanoImagen({ dataUrl: e.target.result, anchoPx: img.naturalWidth, altoPx: img.naturalHeight, nombreArchivo: archivo.name });
          setPlanoCalibracion(null);
          setNodosPlano([]);
          setSegmentosPlano([]);
          setHabitacionesPlano([]);
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

  // Convierte un punto YA en espacio imagen (píxeles) a metros reales y
  // lo registra como nodo nuevo — o reutiliza uno existente si cae
  // dentro del radio de "pegado" (ver RADIO_SNAP_METROS), para que
  // cerrar un polígono comparta el mismo nodo en vez de superponer dos.
  // Devuelve el nodo usado (nuevo o reusado) para que quien llama (el
  // hook de interacción del canvas) pueda encadenar el segmento.
  function agregarNodoPlano(puntoImagen) {
    if (!planoCalibracion) return null;
    const puntoModelo = App.plano.imagenAModelo(puntoImagen, planoCalibracion.escalaMetrosPorPixel);
    const existente = App.plano.nodoCercano(puntoModelo, nodosPlano);
    if (existente) return existente;
    const nodo = App.plano.crearNodo(puntoModelo);
    setNodosPlano([...nodosPlano, nodo]);
    return nodo;
  }

  function agregarSegmentoPlano(nodoAId, nodoBId) {
    if (nodoAId === nodoBId) return;
    const yaExiste = segmentosPlano.some(
      (s) => (s.nodoAId === nodoAId && s.nodoBId === nodoBId) || (s.nodoAId === nodoBId && s.nodoBId === nodoAId)
    );
    if (yaExiste) return;
    setSegmentosPlano([...segmentosPlano, App.plano.crearSegmento(nodoAId, nodoBId)]);
  }

  function eliminarNodoPlano(nodoId) {
    const resultado = App.plano.eliminarNodo(nodoId, nodosPlano, segmentosPlano, habitacionesPlano);
    setNodosPlano(resultado.nodos);
    setSegmentosPlano(resultado.segmentos);
    setHabitacionesPlano(resultado.habitaciones);
  }

  function eliminarSegmentoPlano(segmentoId) {
    setSegmentosPlano(App.plano.eliminarSegmento(segmentoId, segmentosPlano));
  }

  // Registra una habitación a partir de una cadena de nodos YA cerrada
  // (el trazo volvió a su propio nodo de inicio) — ver la nota de Fase
  // 1 en modules/plano/index.js sobre por qué no es detección
  // arbitraria de ciclos.
  function cerrarHabitacionPlano(nodoIds, nombre = "") {
    const habitacion = App.plano.crearHabitacion(nodoIds, nodosPlano, nombre);
    if (!habitacion) return null;
    setHabitacionesPlano([...habitacionesPlano, habitacion]);
    return habitacion;
  }

  function eliminarHabitacionPlano(habitacionId) {
    setHabitacionesPlano(habitacionesPlano.filter((h) => h.id !== habitacionId));
  }

  function renombrarHabitacionPlano(habitacionId, nombre) {
    setHabitacionesPlano(habitacionesPlano.map((h) => (h.id === habitacionId ? { ...h, nombre: nombre.trim() || "Ambiente sin nombre" } : h)));
  }

  function quitarImagenPlano() {
    setPlanoImagen(null);
    setPlanoCalibracion(null);
    setNodosPlano([]);
    setSegmentosPlano([]);
    setHabitacionesPlano([]);
  }

  // --- PROYECTO ---
  function guardarProyecto() {
    const nombre = App.guardarProyecto({
      proyecto,
      normativaActiva,
      tipoInstalacion,
      circuitos,
      equipos,
      tableros,
      fuentesEnergia,
      transformadores,
      nodosDiagrama,
      conexionesDiagrama,
      plano: { imagen: planoImagen, calibracion: planoCalibracion, nodos: nodosPlano, segmentos: segmentosPlano, habitaciones: habitacionesPlano },
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
        setNodosDiagrama(cargado.nodosDiagrama ?? []);
        setConexionesDiagrama(cargado.conexionesDiagrama ?? []);
        setPlanoImagen(cargado.plano?.imagen ?? null);
        setPlanoCalibracion(cargado.plano?.calibracion ?? null);
        setNodosPlano(cargado.plano?.nodos ?? []);
        setSegmentosPlano(cargado.plano?.segmentos ?? []);
        setHabitacionesPlano(cargado.plano?.habitaciones ?? []);
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
    setNodosDiagrama([]);
    setConexionesDiagrama([]);
    setPlanoImagen(null);
    setPlanoCalibracion(null);
    setNodosPlano([]);
    setSegmentosPlano([]);
    setHabitacionesPlano([]);
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
    formEquipo,
    setFormEquipo,
    errorEquipo,
    editandoEquipoId,
    guardarEquipo,
    iniciarEdicionEquipo,
    cancelarEdicionEquipo,
    eliminarEquipo,
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
    nodosDiagrama,
    crearNodoDiagrama,
    editarNodoDiagrama,
    eliminarNodoDiagrama,
    conexionesDiagrama,
    crearConexionDiagrama,
    editarConexionDiagrama,
    eliminarConexionDiagrama,
    planoImagen,
    cargarImagenPlano,
    quitarImagenPlano,
    planoCalibracion,
    calibrarPlano,
    nodosPlano,
    segmentosPlano,
    agregarNodoPlano,
    agregarSegmentoPlano,
    eliminarNodoPlano,
    eliminarSegmentoPlano,
    habitacionesPlano,
    cerrarHabitacionPlano,
    eliminarHabitacionPlano,
    renombrarHabitacionPlano,
    listaIntegridad,
    resumenIntegridad: resumenInt,
    detalleElectrico,
    ESTADOS_INTEGRIDAD: App.validacion.ESTADOS,
  };
}
