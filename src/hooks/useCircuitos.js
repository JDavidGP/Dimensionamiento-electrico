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
  const [nodosDiagrama, setNodosDiagrama] = useState([]);
  const [conexionesDiagrama, setConexionesDiagrama] = useState([]);
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

  const [formCircuito, setFormCircuito] = useState(CIRCUITO_VACIO);
  const [errorCircuito, setErrorCircuito] = useState("");
  const [editandoCircuitoId, setEditandoCircuitoId] = useState(null);
  const [circuitoActivoId, setCircuitoActivoId] = useState(null);

  const [formEquipo, setFormEquipo] = useState(EQUIPO_VACIO);
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
      nodosDiagrama,
      conexionesDiagrama,
      normativaActiva,
      resultados,
    });
  }, [proyecto, circuitos, equipos, tableros, fuentesEnergia, nodosDiagrama, conexionesDiagrama, normativaActiva, resultados]);

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
    () => App.validacion.listaIntegridad(proyecto, circuitos, equipos, tableros, fuentesEnergia, nodosDiagrama),
    [proyecto, circuitos, equipos, tableros, fuentesEnergia, nodosDiagrama]
  );

  const resumenInt = useMemo(
    () => App.validacion.resumen(proyecto, circuitos, equipos, tableros, fuentesEnergia, nodosDiagrama),
    [proyecto, circuitos, equipos, tableros, fuentesEnergia, nodosDiagrama]
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
  function guardarCircuito() {
    const error = App.validacion.validarFormularioCircuito(formCircuito);
    if (error) return setErrorCircuito(error);
    setErrorCircuito("");
    const circuito = App.validacion.formularioACircuito(
      formCircuito,
      editandoCircuitoId
    );

    if (editandoCircuitoId) {
      setCircuitos(circuitos.map((c) => (c.id === editandoCircuitoId ? circuito : c)));
    } else {
      setCircuitos([...circuitos, circuito]);
      setCircuitoActivoId(circuito.id);
    }
    setEditandoCircuitoId(null);
    setFormCircuito(CIRCUITO_VACIO);
  }

  function iniciarEdicionCircuito(id) {
    const circuito = circuitos.find((c) => c.id === id);
    if (!circuito) return;
    setFormCircuito(App.validacion.circuitoAFormulario(circuito));
    setEditandoCircuitoId(id);
    setErrorCircuito("");
  }

  function cancelarEdicionCircuito() {
    setFormCircuito(CIRCUITO_VACIO);
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

    if (editandoEquipoId) {
      setEquipos(equipos.map((e) => (e.id === editandoEquipoId ? equipo : e)));
    } else {
      setEquipos([...equipos, equipo]);
    }
    setEditandoEquipoId(null);
    setFormEquipo(EQUIPO_VACIO);
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
    setFormEquipo(EQUIPO_VACIO);
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
      nodosDiagrama,
      conexionesDiagrama,
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
        setNodosDiagrama(cargado.nodosDiagrama ?? []);
        setConexionesDiagrama(cargado.conexionesDiagrama ?? []);
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
    setNodosDiagrama([]);
    setConexionesDiagrama([]);
    setCircuitoActivoId(null);
    setFormCircuito(CIRCUITO_VACIO);
    setFormEquipo(EQUIPO_VACIO);
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
    nodosDiagrama,
    crearNodoDiagrama,
    editarNodoDiagrama,
    eliminarNodoDiagrama,
    conexionesDiagrama,
    crearConexionDiagrama,
    editarConexionDiagrama,
    eliminarConexionDiagrama,
    listaIntegridad,
    resumenIntegridad: resumenInt,
    detalleElectrico,
    ESTADOS_INTEGRIDAD: App.validacion.ESTADOS,
  };
}
