import React, { useRef, useState } from "react";
import { colores, fuentes } from "../styles/colores";
import { inputStyle } from "./Campo";
import { BotonPill } from "./PanelTableros";
import PlanoCanvas from "./PlanoCanvas";
import { ApplicationMediator as App } from "../core/ApplicationMediator.js";

// Plano inteligente — Fase 1 (2026-11-20): calibración de escala +
// trazado manual de paredes. Ver PLANO_INTELIGENTE_DISENO.md para el
// porqué de la arquitectura (independencia de dispositivo/resolución).
//
// Este componente es la "Interfaz gráfica" — mantiene el `modo` activo
// y el estado de la interacción EN CURSO (calibración pendiente, trazo
// de pared en curso) como estado de React puramente efímero, nunca
// persistido — solo cuando una acción se CONFIRMA (segundo punto de
// calibración + distancia, o un segmento de pared) se llama a una
// función del hook, que es quien de verdad guarda algo en el proyecto.
// Agrupados por etapa de trabajo (usuario, 2026-11-25: "realmente está
// optimizado las opciones de edición... no hay otra forma más sencilla
// de construir" — los 17 modos vivían en una sola fila plana de
// botones, sin ningún agrupamiento, difícil de escanear de un vistazo).
// Puramente visual: cada modo sigue siendo el mismo valor de siempre,
// `cambiarModo` no cambia — solo se agrega `grupo` para poder
// renderizarlos en filas separadas con una etiqueta (ver GRUPOS_MODO
// más abajo y el render de la barra de modos).
const GRUPOS_MODO = ["Vista y calibración", "Paredes y conductores", "Ambientes", "Equipos", "Utilidades"];

const MODOS = [
  { valor: "mover", label: "Mover vista", grupo: "Vista y calibración", ayuda: "Arrastrá para mover, rueda del mouse (o los botones +/−) para zoom." },
  { valor: "perspectiva", label: "Corregir perspectiva", grupo: "Vista y calibración", ayuda: "Para fotos: hacé click en las 4 esquinas de un rectángulo real (ej. una habitación), en orden, dando toda la vuelta." },
  { valor: "calibrar", label: "Calibrar", grupo: "Vista y calibración", ayuda: "Hacé click en dos puntos cuya distancia real conozcas." },
  { valor: "calibrar-perimetro", label: "Calibrar por perímetro", grupo: "Vista y calibración", ayuda: "Trazá el contorno exterior completo (3+ puntos) y declará su perímetro real total." },
  { valor: "pared", label: "Trazar pared", grupo: "Paredes y conductores", ayuda: "Click para ir agregando puntos. Volvé al punto de inicio para cerrar un ambiente." },
  { valor: "espesor", label: "Medir espesor", grupo: "Paredes y conductores", ayuda: "Marcá 2 puntos a los dos lados de una pared ya trazada — se mide el espesor real y se guarda en la pared más cercana." },
  { valor: "conductor", label: "Trazar conductor", grupo: "Paredes y conductores", ayuda: "Click para ir agregando el recorrido de un conductor. No hace falta cerrarlo — terminalo con el botón." },
  { valor: "area_paredes", label: "Reconocer paredes (área)", grupo: "Paredes y conductores", ayuda: "Arrastrá un rectángulo sobre la zona que querés analizar — se buscan líneas candidatas SOLO ahí, con menos ruido que sobre el plano completo." },
  { valor: "ambiente", label: "Generar ambiente", grupo: "Ambientes", ayuda: "Completá el nombre y la medida abajo, y hacé click en el plano donde va el CENTRO del ambiente." },
  { valor: "rectangulo", label: "Trazar rectángulo", grupo: "Ambientes", ayuda: "Hacé click en una esquina del ambiente y arrastrá hasta la esquina opuesta — soltá para crearlo con la medida real." },
  { valor: "mover-ambiente", label: "Mover ambiente", grupo: "Ambientes", ayuda: "Arrastrá un ambiente ya trazado (manual o generado) para reposicionarlo, manteniendo su forma y medida exactas." },
  { valor: "equipo", label: "Colocar equipo", grupo: "Equipos", ayuda: "Elegí el tipo abajo y hacé click en el plano donde va ubicado." },
  { valor: "grupo_equipo", label: "Generar grupo", grupo: "Equipos", ayuda: "Elegí el tipo y la cantidad abajo, y hacé click en el plano — aparecen todos apilados ahí cerca, listos para arrastrar cada uno a su lugar con \"Mover equipo\"." },
  { valor: "grupo_circuito", label: "Generar circuito", grupo: "Equipos", ayuda: "Elegí un circuito ya cargado abajo y hacé click en el plano — aparece un marcador YA VINCULADO por cada uno de sus equipos, apilados ahí cerca, listos para arrastrar cada uno a su lugar real con \"Mover equipo\"." },
  { valor: "mover-equipo", label: "Mover equipo", grupo: "Equipos", ayuda: "Arrastrá un equipo ya colocado (individual o de un grupo) para reposicionarlo." },
  { valor: "triangular", label: "Triangular equipo", grupo: "Equipos", ayuda: "Elegí el tipo arriba. Click en 2 puntos de referencia ya existentes (nodo de pared/conductor o equipo), escribí las 2 distancias medidas con cinta métrica, y confirmá con un click aproximado en el lugar real." },
  { valor: "eliminar", label: "Borrar", grupo: "Utilidades", ayuda: "Click sobre un nodo, una pared/conductor o un equipo para eliminarlo." },
];

// Mismo mapa categoría->color que usa PlanoCanvas.jsx — para el punto
// de color junto a cada opción del <select> de tipo de equipo.
const COLOR_POR_CATEGORIA = { fuente: colores.ok, medicion_proteccion: colores.warn, distribucion: colores.copper, control: colores.copperDim, carga: colores.textDim };

export default function PlanoInteligente({
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
  tableros = [],
  equipos = [],
  circuitos = [],
  fuentesEnergia = [],
  transformadores = [],
  diferenciales = [],
}) {
  const [modo, setModo] = useState("mover");
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState("");

  // "Plano sin imagen" (usuario, 2026-11-24) — el marco inicial del
  // rompecabezas: ancho×alto reales de la casa, sin foto de fondo.
  const [sinImagenAbierto, setSinImagenAbierto] = useState(false);
  const [sinImagenAncho, setSinImagenAncho] = useState("");
  const [sinImagenAlto, setSinImagenAlto] = useState("");
  const [sinImagenNombre, setSinImagenNombre] = useState("");
  const [sinImagenAlturaTecho, setSinImagenAlturaTecho] = useState("");

  // "Sugerir paredes" (usuario, 2026-11-20, "asistencia mejorada, no
  // automática") — PlanoCanvas.jsx expone la detección vía ref porque
  // sigue siendo el ÚNICO componente que toca el DOM/canvas (ver su
  // nota de cabecera). Las sugerencias son ESTADO EFÍMERO (no se
  // persisten como parte del proyecto) hasta que el instalador acepta
  // una con un click — recién ahí se convierte en una pared real.
  const canvasRef = useRef(null);
  const [paredesCandidatas, setParedesCandidatas] = useState([]);
  const [puertasCandidatas, setPuertasCandidatas] = useState([]);
  // Asistencia de bordes (Fase 2) — "pega" cada click de trazado al
  // borde más fuerte cercano en la imagen, ver PlanoCanvas.jsx /
  // modules/plano/deteccionBordes.js. Preferencia de herramienta, NO
  // se persiste (no es un dato del proyecto, es solo cómo trabaja
  // ahora mismo quien está trazando).
  const [asistenciaBordes, setAsistenciaBordes] = useState(true);

  // Enganche automático de "Mover ambiente" (usuario, 2026-11-25) —
  // mismo criterio que asistenciaBordes: preferencia de herramienta,
  // no se persiste. Prendido por defecto (es la mejora que se estaba
  // debiendo desde el "plano sin imagen" v1); se puede apagar si
  // molesta sobre un plano con ambientes trazados a mano de forma
  // irregular (el enganche usa la caja envolvente, ver
  // modules/plano/enganchePuzzle.ts).
  const [engancheAutomatico, setEngancheAutomatico] = useState(true);

  // Capas visibles (usuario, 2026-11-22: "necesitamos algo visual que
  // separe las líneas de las paredes con las rutas de los
  // conductores") — preferencia de herramienta, NO se persiste, mismo
  // criterio que asistenciaBordes arriba: apaga/prende qué SEGMENTOS
  // (paredes/conductores) y marcadores de equipo se DIBUJAN, filtrando
  // antes de pasarle los datos a PlanoCanvas (que sigue sin saber nada
  // de "capas" — solo dibuja lo que recibe, mismo patrón que
  // nodoIdsTrazoActual/paredesCandidatas). Todas activas por defecto.
  const [capasVisibles, setCapasVisibles] = useState({ fondo: true, pared: true, conductor: true, equipos: true });

  // Calibración: null, [puntoA], o [puntoA, puntoB] (ahí se muestra el
  // formulario de distancia real antes de confirmar).
  const [puntosCalibracion, setPuntosCalibracion] = useState([]);
  const [distanciaRealInput, setDistanciaRealInput] = useState("");

  // Calibración alternativa por perímetro (usuario, 2026-11-20): el
  // instalador traza un contorno de N puntos (no un grafo persistido,
  // efímero — igual criterio que puntosCalibracion) y, con 3 o más,
  // puede declarar el perímetro real total en vez de una distancia
  // puntual entre 2 esquinas.
  const [puntosContornoCalibracion, setPuntosContornoCalibracion] = useState([]);
  const [perimetroRealInput, setPerimetroRealInput] = useState("");

  // Medir espesor de pared (usuario, 2026-11-20): 2 clicks a los dos
  // lados del ancho visible de una pared YA trazada — la distancia
  // entre esos 2 puntos, convertida a metros con la escala actual, se
  // guarda como espesorM de la pared más cercana al punto medio de
  // esos 2 clicks (nunca se adivina CUÁL pared si no hay ninguna cerca).
  const [puntosEspesor, setPuntosEspesor] = useState([]);

  // Corrección de perspectiva — 4 puntos (esquinas del rectángulo real
  // en la foto), en orden; al completar los 4 se pide ancho/alto real.
  const [puntosPerspectiva, setPuntosPerspectiva] = useState([]);
  const [anchoRealInput, setAnchoRealInput] = useState("");
  const [altoRealInput, setAltoRealInput] = useState("");
  const [corrigiendoPerspectiva, setCorrigiendoPerspectiva] = useState(false);

  // Trazo de pared (o de conductor, mismo mecanismo — ver modo
  // "conductor") en curso — lista ORDENADA de ids de nodo. Se resetea
  // al cambiar de modo o al cerrar/terminar el trazo.
  const [trazoActual, setTrazoActual] = useState([]);

  // Modo "equipo" — tipo/nombre/entidad elegidos ANTES de hacer click
  // en el plano (el click solo define la UBICACIÓN); mismo catálogo
  // que el diagrama unifilar (ver PlanoMediator.componentesPorCategoria).
  const categoriasEquipo = App.plano.componentesPorCategoria();
  const primeraCategoriaEquipo = Object.keys(categoriasEquipo)[0];
  const [tipoEquipoSeleccionado, setTipoEquipoSeleccionado] = useState(categoriasEquipo[primeraCategoriaEquipo]?.[0]?.id ?? "");
  const [nombreEquipoNuevo, setNombreEquipoNuevo] = useState("");
  const [entidadEquipoNuevo, setEntidadEquipoNuevo] = useState("");
  // "¿Qué equipo ya ingresado es?" (usuario, 2026-11-25: "en Circuitos
  // y resultados ya están los equipos ingresados correcto, por qué no
  // llevamos esos ID directamente al plano... y lo ubicamos de forma
  // más sencilla") — ANTES había que adivinar manualmente qué símbolo
  // (tipo) correspondía a cada equipo real y recién ahí buscarlo en un
  // segundo selector ya filtrado por ese tipo (candidatosEntidadEquipo
  // en realidad no filtra por tipo — ver la nota ahí — así que ese
  // segundo selector mostraba CUALQUIER equipo, aunque no calzara con
  // el símbolo elegido). Este selector es nuevo y cruza TODOS los
  // tipos de una: al elegir un equipo real, el símbolo se adivina solo
  // (mismo motor heurístico que arma el diagrama automático, ver
  // App.diagrama.elegirSimboloEquipo) y el selector de tipo de abajo
  // queda como override manual, no como paso obligatorio.
  const [equipoYaIngresadoSeleccionado, setEquipoYaIngresadoSeleccionado] = useState("");

  function alElegirEquipoYaIngresado(equipoId) {
    setEquipoYaIngresadoSeleccionado(equipoId);
    if (!equipoId) return;
    const equipo = equipos.find((e) => e.id === equipoId);
    if (!equipo) return;
    setTipoEquipoSeleccionado(App.diagrama.elegirSimboloEquipo(equipo));
    setEntidadEquipoNuevo(equipoId);
    setNombreEquipoNuevo(equipo.nombre || "");
  }

  // Modo "grupo_equipo" (usuario, 2026-11-24) — mismo tipo/nombre-base
  // que "equipo", más la cantidad a generar de una vez.
  const [cantidadGrupoEquipo, setCantidadGrupoEquipo] = useState("1");

  // Modo "grupo_circuito" (usuario, 2026-11-25: "desde el diagrama
  // unifilar se puede generar el circuito completo con sus
  // consumidores finales... ya con sus id ya vinculado") — circuito
  // elegido para generar su grupo de marcadores YA vinculados.
  const [circuitoGrupoSeleccionado, setCircuitoGrupoSeleccionado] = useState("");

  // "Sugerir ruta automática" (usuario, 2026-11-25) — circuito elegido
  // para conectar tablero→cada equipo por el camino más corto sobre la
  // red de conductores ya trazada. No es un "modo" de click en el
  // plano (los puntos ya se conocen: los marcadores existentes) — es
  // una acción directa, por eso vive junto al panel "Rutas de
  // conductor", no en la barra de modos.
  const [circuitoRutaAutoSeleccionado, setCircuitoRutaAutoSeleccionado] = useState("");

  // Triangulación por recorrido (usuario, 2026-11-21): ubicar un
  // equipo sin tocar la imagen directamente — click en 2 puntos de
  // referencia YA existentes (nodo del grafo o equipo ya marcado),
  // declarar las 2 distancias reales medidas con cinta métrica, y
  // confirmar cuál de las 1-2 soluciones geométricas es la correcta
  // con un click aproximado. El equipo recién ubicado queda disponible
  // como referencia para el siguiente (ver alClickImagen, modo
  // "triangular" y marcadorCercano más abajo) — así se "recorre" el
  // sitio encadenando puntos, sin volver siempre a los 2 originales.
  const [referenciasTriangulacion, setReferenciasTriangulacion] = useState([]); // hasta 2 {id, punto}
  const [distancia1TriangulacionInput, setDistancia1TriangulacionInput] = useState("");
  const [distancia2TriangulacionInput, setDistancia2TriangulacionInput] = useState("");
  const [candidatosTriangulacion, setCandidatosTriangulacion] = useState([]); // 0-2 puntos MODELO (metros), resultado de interseccionCirculos

  // Modo "ambiente" — generador por dimensión conocida (pedido
  // explícito del usuario: "etiqueta + perímetro 12x8m" → un polígono
  // de ese tamaño exacto, en vez de trazarlo a mano). nombre/ancho/alto
  // se completan ANTES de hacer click (el click solo define el CENTRO
  // donde aparece), mismo criterio que el modo "equipo".
  const [nombreAmbienteNuevo, setNombreAmbienteNuevo] = useState("");
  const [anchoAmbienteInput, setAnchoAmbienteInput] = useState("");
  const [altoAmbienteInput, setAltoAmbienteInput] = useState("");

  function etiquetaEntidadEquipo(tipoEquipo, entidad) {
    const comp = App.plano.obtenerComponente(tipoEquipo);
    if (comp?.entidadVinculada === "equipo") {
      const circuito = circuitos.find((c) => c.id === entidad.circuitoId);
      const tablero = circuito ? tableros.find((t) => t.id === circuito.tableroId) : null;
      const contexto = [circuito?.nombre, tablero?.nombre].filter(Boolean).join(" · ");
      return contexto ? `${entidad.nombre || "Equipo sin nombre"} (${contexto})` : entidad.nombre || "Equipo sin nombre";
    }
    if (comp?.entidadVinculada === "circuito") {
      const tablero = tableros.find((t) => t.id === entidad.tableroId);
      const etiqueta = entidad.etiqueta ? `${entidad.etiqueta} — ` : "";
      return tablero ? `${etiqueta}${entidad.nombre || "Circuito sin nombre"} (${tablero.nombre})` : `${etiqueta}${entidad.nombre || "Circuito sin nombre"}`;
    }
    if (comp?.entidadVinculada === "diferencial") {
      const cantidad = circuitos.filter((c) => c.diferencialId === entidad.id).length;
      return `${entidad.nombre || "Diferencial sin nombre"} (${entidad.sensibilidadMA ?? 30}mA · ${cantidad} circuito${cantidad === 1 ? "" : "s"})`;
    }
    return entidad.nombre || "(sin nombre)";
  }

  function mostrarAviso(texto) {
    setAviso(texto);
    setTimeout(() => setAviso(""), 5000);
  }

  function cambiarModo(nuevoModo) {
    setModo(nuevoModo);
    setPuntosCalibracion([]);
    setDistanciaRealInput("");
    setPuntosContornoCalibracion([]);
    setPerimetroRealInput("");
    setPuntosEspesor([]);
    setPuntosPerspectiva([]);
    setAnchoRealInput("");
    setAltoRealInput("");
    setTrazoActual([]);
    setEntidadEquipoNuevo("");
    setReferenciasTriangulacion([]);
    setDistancia1TriangulacionInput("");
    setDistancia2TriangulacionInput("");
    setCandidatosTriangulacion([]);
  }

  function reiniciarTriangulacion() {
    setReferenciasTriangulacion([]);
    setDistancia1TriangulacionInput("");
    setDistancia2TriangulacionInput("");
    setCandidatosTriangulacion([]);
  }

  function calcularCandidatosTriangulacion(e) {
    e.preventDefault();
    const d1 = parseFloat(distancia1TriangulacionInput);
    const d2 = parseFloat(distancia2TriangulacionInput);
    if (!(d1 > 0) || !(d2 > 0)) {
      mostrarAviso("Completá las 2 distancias (metros, mayores a 0).");
      return;
    }
    const [refA, refB] = referenciasTriangulacion;
    const candidatos = App.plano.interseccionCirculos(refA.punto, d1, refB.punto, d2);
    if (candidatos.length === 0) {
      const separacionReal = App.plano.distancia(refA.punto, refB.punto);
      mostrarAviso(
        `Esas 2 distancias no son compatibles con la separación real entre las 2 referencias (${separacionReal.toFixed(2)} m) — revisá la medición.`
      );
      return;
    }
    setCandidatosTriangulacion(candidatos);
    mostrarAviso(
      candidatos.length === 1
        ? "Un único punto posible — hacé click cerca de él en el plano para confirmarlo."
        : "2 puntos posibles (uno de cada lado) — hacé click cerca del que sabés que es el correcto."
    );
  }

  function alCrearPlanoSinImagen(e) {
    e.preventDefault();
    const ancho = parseFloat(sinImagenAncho);
    const alto = parseFloat(sinImagenAlto);
    const alturaTecho = sinImagenAlturaTecho ? parseFloat(sinImagenAlturaTecho) : null;
    const resultado = crearPlanoSinImagen(ancho, alto, sinImagenNombre, alturaTecho);
    if (!resultado) {
      mostrarAviso("El ancho y el largo deben ser mayores a 0.");
      return;
    }
    setSinImagenAbierto(false);
    setSinImagenAncho("");
    setSinImagenAlto("");
    setSinImagenNombre("");
    setSinImagenAlturaTecho("");
    cambiarModo("rectangulo");
    mostrarAviso(
      `Marco de ${ancho}m × ${alto}m creado y ya calibrado${resultado.alturaTechoM ? ` (altura de techo: ${resultado.alturaTechoM}m)` : ""} — usá "Trazar rectángulo" o "Generar ambiente" para ir agregando cada habitación por su medida, y "Mover ambiente" para acomodarlas dentro del marco.`
    );
  }

  async function alSeleccionarArchivo(e) {
    const archivo = e.target.files[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo después
    if (!archivo) return;
    setCargando(true);
    try {
      await cargarImagenPlano(archivo);
      cambiarModo("mover");
    } catch (err) {
      mostrarAviso(err.message || "No se pudo cargar la imagen.");
    } finally {
      setCargando(false);
    }
  }

  function alClickImagen(puntoImagen) {
    if (modo === "perspectiva") {
      if (puntosPerspectiva.length < 4) {
        setPuntosPerspectiva([...puntosPerspectiva, puntoImagen]);
      }
      return;
    }

    if (modo === "calibrar") {
      if (puntosCalibracion.length < 2) {
        setPuntosCalibracion([...puntosCalibracion, puntoImagen]);
      }
      return;
    }

    if (modo === "calibrar-perimetro") {
      setPuntosContornoCalibracion([...puntosContornoCalibracion, puntoImagen]);
      return;
    }

    if (modo === "espesor") {
      if (puntosEspesor.length < 1) {
        setPuntosEspesor([puntoImagen]);
        return;
      }
      const escala = planoCalibracion?.escalaMetrosPorPixel;
      const puntoA = puntosEspesor[0];
      setPuntosEspesor([]);
      if (!escala) {
        mostrarAviso("Calibrá el plano primero.");
        return;
      }
      const espesorM = Math.hypot(puntoImagen.x - puntoA.x, puntoImagen.y - puntoA.y) * escala;
      const puntoMedioImagen = { x: (puntoImagen.x + puntoA.x) / 2, y: (puntoImagen.y + puntoA.y) / 2 };
      const puntoMedioModelo = App.plano.imagenAModelo(puntoMedioImagen, escala);
      const segmento = segmentoMasCercano(puntoMedioModelo, nodosPlano, segmentosPlano);
      if (!segmento) {
        mostrarAviso("No hay ninguna pared cerca de esos 2 puntos — no se guardó nada.");
        return;
      }
      if (segmento.tipo !== "pared") {
        mostrarAviso(`El segmento más cercano es un "${segmento.tipo}", no una pared — no se guardó nada.`);
        return;
      }
      editarSegmentoPlano(segmento.id, { espesorM });
      mostrarAviso(`Espesor guardado: ${(espesorM * 100).toFixed(1)} cm.`);
      return;
    }

    if (modo === "pared") {
      const nodo = agregarNodoPlano(puntoImagen);
      if (!nodo) return; // sin calibrar todavía
      if (trazoActual.length === 0) {
        setTrazoActual([nodo.id]);
        return;
      }
      const nodoAnteriorId = trazoActual[trazoActual.length - 1];
      if (nodo.id === nodoAnteriorId) return; // click repetido sobre el mismo punto
      agregarSegmentoPlano(nodoAnteriorId, nodo.id);

      if (nodo.id === trazoActual[0] && trazoActual.length >= 3) {
        // El trazo volvió a su propio inicio — se cierra como habitación.
        const nombre = window.prompt("Nombre del ambiente (opcional):", "") ?? "";
        cerrarHabitacionPlano(trazoActual, nombre);
        setTrazoActual([]);
        mostrarAviso("Ambiente cerrado — área y perímetro calculados.");
        return;
      }
      setTrazoActual([...trazoActual, nodo.id]);
      return;
    }

    if (modo === "conductor") {
      const nodo = agregarNodoPlano(puntoImagen, true); // true: pegar al equipo marcado más cercano, si hay uno
      if (!nodo) return; // sin calibrar todavía
      if (trazoActual.length === 0) {
        setTrazoActual([nodo.id]);
        return;
      }
      const nodoAnteriorId = trazoActual[trazoActual.length - 1];
      if (nodo.id === nodoAnteriorId) return; // click repetido sobre el mismo punto
      agregarSegmentoPlano(nodoAnteriorId, nodo.id, "conductor");
      setTrazoActual([...trazoActual, nodo.id]);
      return;
    }

    if (modo === "ambiente") {
      const ancho = parseFloat(anchoAmbienteInput);
      const alto = parseFloat(altoAmbienteInput);
      if (!(ancho > 0) || !(alto > 0)) {
        mostrarAviso("Completá un ancho y un largo mayores a 0 antes de hacer click.");
        return;
      }
      const habitacion = generarHabitacionPlano(puntoImagen, nombreAmbienteNuevo, ancho, alto);
      if (!habitacion) return; // sin calibrar todavía
      mostrarAviso(`"${habitacion.nombre}" generado — ${habitacion.areaM2.toFixed(2)} m². Podés reposicionarlo con "Mover ambiente".`);
      return;
    }

    if (modo === "equipo") {
      if (!tipoEquipoSeleccionado) return;
      const marcador = agregarMarcadorEquipoPlano(puntoImagen, tipoEquipoSeleccionado, entidadEquipoNuevo || null, nombreEquipoNuevo);
      // agregarMarcadorEquipoPlano devuelve null sin calibrar (requiere
      // escalaMetrosPorPixel) — antes esto fallaba en silencio, un
      // click sin efecto y sin explicación; mismo aviso que ya usa el
      // modo "triangular" para el mismo caso.
      if (!marcador) {
        mostrarAviso("Calibrá el plano primero.");
        return;
      }
      // Tras colocar un equipo YA vinculado, limpiar el selector de
      // "¿Equipo ya ingresado?" — ese equipo ya no es candidato (queda
      // excluido de la lista al estar vinculado), dejarlo seleccionado
      // mostraría un valor que ya no está entre las opciones.
      if (entidadEquipoNuevo) {
        setEquipoYaIngresadoSeleccionado("");
        setEntidadEquipoNuevo("");
        setNombreEquipoNuevo("");
      }
      return;
    }

    if (modo === "grupo_equipo") {
      if (!tipoEquipoSeleccionado) return;
      const cantidad = parseInt(cantidadGrupoEquipo, 10);
      const nuevos = generarGrupoMarcadoresEquipoPlano(puntoImagen, tipoEquipoSeleccionado, cantidad, nombreEquipoNuevo);
      if (!nuevos) {
        mostrarAviso(planoCalibracion ? "Cantidad inválida — usá un número entero entre 1 y 50." : "Calibrá el plano primero.");
        return;
      }
      mostrarAviso(`${nuevos.length} equipo(s) generado(s), apilados cerca del click — arrastrá cada uno a su lugar real con "Mover equipo".`);
      return;
    }

    if (modo === "grupo_circuito") {
      if (!circuitoGrupoSeleccionado) {
        mostrarAviso("Elegí un circuito primero.");
        return;
      }
      const resultado = generarCircuitoMarcadoresEquipoPlano(puntoImagen, circuitoGrupoSeleccionado);
      if (!resultado) {
        mostrarAviso("Calibrá el plano primero.");
        return;
      }
      if (!resultado.circuitoGenerado && resultado.nuevos.length === 0) {
        mostrarAviso(
          resultado.total === 0
            ? "Ese circuito ya tiene su propio marcador y todavía no tiene equipos cargados en Circuitos y resultados."
            : "Ese circuito y todos sus equipos ya tienen marcador en el plano — no se generó ninguno nuevo."
        );
        return;
      }
      const saltados = resultado.total - resultado.nuevos.length;
      const partes = [];
      if (resultado.circuitoGenerado) partes.push("el marcador del circuito (PIA)");
      if (resultado.nuevos.length > 0) partes.push(`${resultado.nuevos.length} equipo(s)`);
      mostrarAviso(
        `Se generó ${partes.join(" + ")}, YA vinculados a sus entidades reales, apilados cerca del click — arrastrá cada uno a su lugar real con "Mover equipo".` +
          (saltados > 0 ? ` (${saltados} equipo(s) ya tenían marcador y se saltaron.)` : "")
      );
      return;
    }

    if (modo === "triangular") {
      const escala = planoCalibracion?.escalaMetrosPorPixel;
      if (!escala) {
        mostrarAviso("Calibrá el plano primero.");
        return;
      }
      manejarPuntoTriangulacion(App.plano.imagenAModelo(puntoImagen, escala));
      return;
    }

    if (modo === "eliminar") {
      const escala = planoCalibracion?.escalaMetrosPorPixel ?? 1;
      const puntoModelo = App.plano.imagenAModelo(puntoImagen, escala);
      const nodoCercano = App.plano.nodoCercano(puntoModelo, nodosPlano, escala * 12); // ~12px de tolerancia en cualquier zoom
      if (nodoCercano) {
        eliminarNodoPlano(nodoCercano.id);
        return;
      }
      // Si no hay nodo cerca, probar con el segmento más cercano.
      const segmentoCercano = segmentoMasCercano(puntoModelo, nodosPlano, segmentosPlano);
      if (segmentoCercano) eliminarSegmentoPlano(segmentoCercano.id);
    }
  }

  // Modo "rectangulo" (usuario, 2026-11-23: "click en una esquina...
  // estiramos hacia la otra esquina") — tercera forma de crear un
  // ambiente rectangular, junto al trazado manual y "Generar ambiente"
  // por medida ya conocida: PlanoCanvas.jsx ya hizo todo el trabajo de
  // arrastre/vista previa en vivo, acá solo llega el resultado final
  // (las 2 esquinas, en espacio imagen) al soltar.
  function alTrazarRectangulo(puntoImagenA, puntoImagenB) {
    if (modo === "area_paredes") {
      reconocerParedesEnArea(puntoImagenA, puntoImagenB);
      return;
    }
    const nombre = window.prompt("Nombre del ambiente (opcional):", "") ?? "";
    const habitacion = generarHabitacionPorArrastre(puntoImagenA, puntoImagenB, nombre);
    if (!habitacion) {
      mostrarAviso(planoCalibracion ? "El arrastre fue demasiado chico — probá estirar más el rectángulo." : "Calibrá el plano primero.");
      return;
    }
    mostrarAviso(`"${habitacion.nombre}" generado — ${habitacion.areaM2.toFixed(2)} m². Podés reposicionarlo con "Mover ambiente".`);
  }

  // "Reconocer paredes (área)" — usuario, 2026-11-24: arrastrar un
  // rectángulo sobre la zona a analizar, en vez del botón "Sugerir
  // paredes" de antes (que siempre leía el plano COMPLETO — mucho más
  // ruido/falsos positivos en un plano grande). Mismo gesto de
  // arrastre que "Trazar rectángulo" (PlanoCanvas.jsx ya lo resuelve),
  // acá solo se decide qué hacer con las 2 esquinas.
  const AREA_MINIMA_DETECCION_PX = 20;
  function reconocerParedesEnArea(puntoImagenA, puntoImagenB) {
    const x = Math.max(0, Math.round(Math.min(puntoImagenA.x, puntoImagenB.x)));
    const y = Math.max(0, Math.round(Math.min(puntoImagenA.y, puntoImagenB.y)));
    const ancho = Math.round(Math.abs(puntoImagenB.x - puntoImagenA.x));
    const alto = Math.round(Math.abs(puntoImagenB.y - puntoImagenA.y));
    if (ancho < AREA_MINIMA_DETECCION_PX || alto < AREA_MINIMA_DETECCION_PX) {
      mostrarAviso("El área fue demasiado chica — probá estirar más el rectángulo.");
      return;
    }
    const resultado = canvasRef.current?.detectarParedesCandidatas({ x, y, ancho, alto }) ?? { paredes: [], puertas: [] };
    setParedesCandidatas(resultado.paredes);
    setPuertasCandidatas(resultado.puertas);
    if (resultado.paredes.length === 0) {
      mostrarAviso("No se encontraron líneas rectas candidatas en esa área (solo detecta horizontales/verticales).");
    } else {
      mostrarAviso(
        `${resultado.paredes.length} pared(es) candidata(s)${resultado.puertas.length > 0 ? ` y ${resultado.puertas.length} posible(s) puerta(s)` : ""} en el área elegida — hacé click en una línea naranja para confirmarla como pared real.`
      );
    }
  }

  // Compartida entre alClickImagen (click en vacío, busca el nodo/equipo
  // más cercano) y alClickMarcador (click directo SOBRE un equipo ya
  // marcado, que por su propio manejador de click no deja pasar el
  // evento al lienzo) — mismo criterio en los 2 casos, nunca duplicado.
  // `referenciaDirecta`, si viene, YA es el nodo/equipo exacto (saltea
  // la búsqueda por cercanía).
  function manejarPuntoTriangulacion(puntoModelo, referenciaDirecta = null) {
    if (candidatosTriangulacion.length > 0) {
      if (!tipoEquipoSeleccionado) {
        mostrarAviso("Elegí un tipo de equipo arriba antes de confirmar.");
        return;
      }
      const elegido = candidatosTriangulacion.reduce((masCercano, c) =>
        App.plano.distancia(puntoModelo, c) < App.plano.distancia(puntoModelo, masCercano) ? c : masCercano
      );
      const escala = planoCalibracion.escalaMetrosPorPixel;
      const puntoImagenElegido = App.plano.modeloAImagen(elegido, escala);
      agregarMarcadorEquipoPlano(puntoImagenElegido, tipoEquipoSeleccionado, entidadEquipoNuevo || null, nombreEquipoNuevo);
      if (entidadEquipoNuevo) {
        setEquipoYaIngresadoSeleccionado("");
        setEntidadEquipoNuevo("");
        setNombreEquipoNuevo("");
      }
      reiniciarTriangulacion();
      mostrarAviso("Equipo ubicado por triangulación — ya podés usarlo de referencia para el siguiente.");
      return;
    }

    if (referenciasTriangulacion.length < 2) {
      const escala = planoCalibracion.escalaMetrosPorPixel;
      const cercano = referenciaDirecta ?? App.plano.nodoCercano(puntoModelo, [...nodosPlano, ...marcadoresEquipoPlano], escala * 12);
      if (!cercano) {
        mostrarAviso("No hay ningún nodo o equipo ya ubicado cerca de ese click — ese es el tipo de punto que hace falta como referencia.");
        return;
      }
      if (referenciasTriangulacion.some((r) => r.id === cercano.id)) {
        mostrarAviso("Ese punto ya es una de las 2 referencias — elegí uno distinto.");
        return;
      }
      setReferenciasTriangulacion([...referenciasTriangulacion, cercano]);
    }
  }

  function alClickMarcador(marcador) {
    if (modo === "triangular") {
      manejarPuntoTriangulacion(marcador.punto, marcador);
      return;
    }
    if (modo !== "eliminar") return;
    eliminarMarcadorEquipoPlano(marcador.id);
  }

  function terminarRutaConductor() {
    if (trazoActual.length < 2) {
      setTrazoActual([]);
      return;
    }
    const nombre = window.prompt("Nombre del conductor/ruta (opcional):", "") ?? "";
    const ruta = cerrarRutaConductorPlano(trazoActual, nombre);
    setTrazoActual([]);
    if (ruta) mostrarAviso(`Ruta registrada — longitud ${ruta.longitudM.toFixed(2)} m.`);
  }

  function terminarTrazo() {
    setTrazoActual([]);
  }

  function descartarSugerencias() {
    setParedesCandidatas([]);
    setPuertasCandidatas([]);
  }

  /** Confirma UNA pared candidata: crea los 2 nodos reales (reusando cercanos, igual que un trazo a mano) + el segmento, y la saca de la lista de sugerencias. */
  function aceptarParedCandidata(candidato) {
    const nodoA = agregarNodoPlano({ x: candidato.x1, y: candidato.y1 });
    const nodoB = agregarNodoPlano({ x: candidato.x2, y: candidato.y2 });
    if (nodoA && nodoB) agregarSegmentoPlano(nodoA.id, nodoB.id, "pared");
    setParedesCandidatas(paredesCandidatas.filter((c) => c !== candidato));
  }

  async function confirmarPerspectiva(e) {
    e.preventDefault();
    setCorrigiendoPerspectiva(true);
    try {
      const resultado = await corregirPerspectivaPlano(puntosPerspectiva, parseFloat(anchoRealInput), parseFloat(altoRealInput));
      if (!resultado.ok) {
        mostrarAviso(resultado.motivo);
        return;
      }
      mostrarAviso("Perspectiva corregida — el plano ya quedó calibrado, podés trazar directo.");
      cambiarModo("pared");
    } finally {
      setCorrigiendoPerspectiva(false);
    }
  }

  function confirmarCalibracionPerimetro(e) {
    e.preventDefault();
    const perimetro = parseFloat(perimetroRealInput);
    const resultado = calibrarPlanoPorPerimetro(puntosContornoCalibracion, perimetro);
    if (!resultado.ok) {
      mostrarAviso(resultado.motivo);
      return;
    }
    mostrarAviso(`Calibrado por perímetro: ${resultado.calibracion.escalaMetrosPorPixel.toFixed(5)} m por píxel de imagen.`);
    cambiarModo("pared");
  }

  function confirmarCalibracion(e) {
    e.preventDefault();
    const distancia = parseFloat(distanciaRealInput);
    const resultado = calibrarPlano(puntosCalibracion[0], puntosCalibracion[1], distancia);
    if (!resultado.ok) {
      mostrarAviso(resultado.motivo);
      return;
    }
    mostrarAviso(`Calibrado: ${resultado.calibracion.escalaMetrosPorPixel.toFixed(5)} m por píxel de imagen.`);
    setPuntosCalibracion([]);
    setDistanciaRealInput("");
    cambiarModo("pared");
  }

  return (
    <div className="plano-grid" style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 14, alignItems: "start" }}>
      <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 11, color: colores.textDim, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Plano inteligente
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <label
              style={{ padding: "6px 12px", borderRadius: 3, border: `1px solid ${colores.border}`, background: "transparent", color: colores.copper, fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}
            >
              {cargando ? "Cargando…" : planoImagen ? "↻ Cambiar plano" : "↑ Cargar plano (imagen o PDF)"}
              <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={alSeleccionarArchivo} disabled={cargando} />
            </label>
            <button
              type="button"
              onClick={() => setSinImagenAbierto((v) => !v)}
              style={{ padding: "6px 12px", borderRadius: 3, border: `1px solid ${colores.border}`, background: "transparent", color: colores.copper, fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}
              title="Para instalaciones sin foto ni plano escaneado: armá uno simple a partir de las medidas reales, como un rompecabezas."
            >
              + Crear plano sin imagen
            </button>
            {planoImagen && (
              <button
                type="button"
                onClick={deshacerPlano}
                disabled={!puedeDeshacerPlano}
                style={{ padding: "6px 12px", borderRadius: 3, border: `1px solid ${colores.border}`, background: "transparent", color: puedeDeshacerPlano ? colores.copper : colores.textDim, fontWeight: 700, fontSize: 11.5, cursor: puedeDeshacerPlano ? "pointer" : "not-allowed" }}
                title="Deshace la última acción de trazado (crear/borrar/mover pared, ambiente o equipo)."
              >
                ↶ Deshacer
              </button>
            )}
            {planoImagen && (nodosPlano.length > 0 || marcadoresEquipoPlano.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("¿Restablecer el trazado? Se borran las paredes, ambientes, rutas y equipos ya colocados — la imagen y la calibración NO se tocan.")) {
                    restablecerPlano();
                  }
                }}
                style={{ padding: "6px 12px", borderRadius: 3, border: `1px solid ${colores.border}`, background: "transparent", color: colores.error, fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}
                title="Borra todo lo trazado (paredes, ambientes, rutas, equipos) y empieza de nuevo sobre la misma imagen ya calibrada."
              >
                ↺ Restablecer
              </button>
            )}
            {segmentosPlano.length > 0 && (
              <button
                type="button"
                onClick={exportarDXFPlano}
                style={{ padding: "6px 12px", borderRadius: 3, border: `1px solid ${colores.border}`, background: "transparent", color: colores.copper, fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}
                title="Exporta las paredes y ambientes trazados como archivo .dxf, para abrir en AutoCAD/LibreCAD/QCAD"
              >
                ⬇ Exportar DXF
              </button>
            )}
            {planoImagen && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("¿Quitar el plano y todo lo trazado sobre él?")) {
                    quitarImagenPlano();
                    cambiarModo("mover");
                  }
                }}
                style={{ padding: "6px 12px", borderRadius: 3, border: `1px solid ${colores.border}`, background: "transparent", color: colores.error, fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}
              >
                × Quitar
              </button>
            )}
          </div>
        </div>

        {sinImagenAbierto && (
          <form
            onSubmit={alCrearPlanoSinImagen}
            style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10, padding: 10, border: `1px solid ${colores.border}`, borderRadius: 3 }}
          >
            <div style={{ fontSize: 11, color: colores.textDim, flexBasis: "100%", lineHeight: 1.4 }}>
              El marco de la casa — las habitaciones se agregan después, cada una por su propia medida.
              {planoImagen && " Esto reemplaza el plano actual."}
            </div>
            <div>
              <div style={{ fontSize: 10, color: colores.textDim, marginBottom: 4 }}>Ancho total (m)</div>
              <input
                type="number"
                step="0.01"
                value={sinImagenAncho}
                onChange={(e) => setSinImagenAncho(e.target.value)}
                placeholder="Ej: 10"
                style={{ ...inputStyle(), width: 90 }}
              />
            </div>
            <div>
              <div style={{ fontSize: 10, color: colores.textDim, marginBottom: 4 }}>Largo total (m)</div>
              <input
                type="number"
                step="0.01"
                value={sinImagenAlto}
                onChange={(e) => setSinImagenAlto(e.target.value)}
                placeholder="Ej: 8"
                style={{ ...inputStyle(), width: 90 }}
              />
            </div>
            <div>
              <div style={{ fontSize: 10, color: colores.textDim, marginBottom: 4 }}>Altura de techo (m, opcional)</div>
              <input
                type="number"
                step="0.01"
                value={sinImagenAlturaTecho}
                onChange={(e) => setSinImagenAlturaTecho(e.target.value)}
                placeholder="Ej: 2.4"
                title="Piso a viga corona/encofrado — dato real distinto del largo en planta, para el tramo vertical del conductor hacia tomas e interruptores."
                style={{ ...inputStyle(), width: 90 }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 10, color: colores.textDim, marginBottom: 4 }}>Nombre (opcional)</div>
              <input
                value={sinImagenNombre}
                onChange={(e) => setSinImagenNombre(e.target.value)}
                placeholder="Ej: Casa Familia Pérez"
                style={inputStyle()}
              />
            </div>
            <button
              type="submit"
              style={{ padding: "8px 14px", borderRadius: 3, border: "none", background: colores.copper, color: colores.textSobreAcento, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
            >
              + Crear marco
            </button>
            <button
              type="button"
              onClick={() => setSinImagenAbierto(false)}
              style={{ padding: "8px 14px", background: "transparent", color: colores.textDim, border: `1px solid ${colores.border}`, borderRadius: 3, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}
            >
              Cancelar
            </button>
          </form>
        )}

        {aviso && (
          <div style={{ fontSize: 12, color: colores.warn, marginBottom: 10, padding: "6px 10px", border: `1px solid ${colores.warn}`, borderRadius: 3 }}>
            {aviso}
          </div>
        )}

        {planoImagen?.paginasTotal > 1 && (
          <div style={{ fontSize: 11, color: colores.textDim, marginBottom: 10 }}>
            Este PDF tiene {planoImagen.paginasTotal} páginas — por ahora se usa solo la primera.
          </div>
        )}

        {planoImagen && (
          <>
            <div style={{ marginBottom: 6 }}>
              {GRUPOS_MODO.map((grupo) => (
                <div key={grupo} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 5, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 9.5, color: colores.textDim, textTransform: "uppercase", letterSpacing: "0.04em", width: 118, flexShrink: 0 }}>
                    {grupo}
                  </span>
                  {MODOS.filter((m) => m.grupo === grupo).map((m) => (
                    <BotonPill key={m.valor} activo={modo === m.valor} onClick={() => cambiarModo(m.valor)} flex="0 0 auto">
                      {m.label}
                    </BotonPill>
                  ))}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, fontSize: 11, color: colores.textDim }}>
              <span>Mostrar:</span>
              {[
                { clave: "fondo", label: "Imagen de fondo" },
                { clave: "pared", label: "Paredes" },
                { clave: "conductor", label: "Conductores" },
                { clave: "equipos", label: "Equipos" },
              ].map((c) => (
                <label key={c.clave} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="checkbox"
                    checked={capasVisibles[c.clave]}
                    onChange={(e) => setCapasVisibles({ ...capasVisibles, [c.clave]: e.target.checked })}
                  />
                  {c.label}
                </label>
              ))}
            </div>

            {/* Estado de "Reconocer paredes (área)" (modo arriba) — no es un
                botón de acción, el gesto de arrastre ya dispara el
                análisis (ver reconocerParedesEnArea). Esto solo muestra
                el resultado: líneas candidatas que se aceptan de a una
                con un click (ver aceptarParedCandidata), o se descartan
                todas. Reemplaza al viejo botón "Sugerir paredes"
                (2026-11-20, analizaba SIEMPRE el plano completo —
                simplificado/acotado a una zona, usuario 2026-11-24). */}
            {(paredesCandidatas.length > 0 || puertasCandidatas.length > 0) && (
              <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: colores.textDim }}>
                  {paredesCandidatas.length} candidata(s){puertasCandidatas.length > 0 ? `, ${puertasCandidatas.length} posible(s) puerta(s)` : ""} — click en una línea naranja del lienzo para confirmarla.
                </span>
                <button
                  type="button"
                  onClick={descartarSugerencias}
                  style={{ padding: "5px 10px", background: "transparent", color: colores.textDim, border: `1px solid ${colores.border}`, borderRadius: 3, fontSize: 11, cursor: "pointer" }}
                >
                  Descartar
                </button>
              </div>
            )}
            <div style={{ fontSize: 11, color: colores.textDim, marginBottom: 10, lineHeight: 1.4 }}>
              {MODOS.find((m) => m.valor === modo)?.ayuda}
              {modo === "perspectiva" && puntosPerspectiva.length > 0 && puntosPerspectiva.length < 4 && ` (van ${puntosPerspectiva.length} de 4)`}
              {(modo === "pared" || modo === "conductor" || modo === "ambiente" || modo === "rectangulo" || modo === "equipo" || modo === "grupo_equipo" || modo === "grupo_circuito") && !planoCalibracion && " — primero calibrá la escala."}
              {modo === "pared" && trazoActual.length > 0 && (
                <>
                  {" "}·{" "}
                  <button type="button" onClick={terminarTrazo} style={{ background: "none", border: "none", color: colores.copper, fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 11 }}>
                    Terminar este trazo sin cerrar
                  </button>
                </>
              )}
              {modo === "conductor" && trazoActual.length > 0 && (
                <>
                  {" "}·{" "}
                  <button type="button" onClick={terminarRutaConductor} style={{ background: "none", border: "none", color: colores.copper, fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 11 }}>
                    Terminar ruta ({trazoActual.length} punto{trazoActual.length === 1 ? "" : "s"})
                  </button>
                </>
              )}
              {(modo === "calibrar-perimetro" || ((modo === "pared" || modo === "conductor" || modo === "espesor") && planoCalibracion)) && (
                <>
                  {" "}·{" "}
                  <label style={{ cursor: "pointer" }}>
                    <input type="checkbox" checked={asistenciaBordes} onChange={(e) => setAsistenciaBordes(e.target.checked)} style={{ marginRight: 4 }} />
                    Asistencia de bordes (pega el click al filo más cercano)
                  </label>
                </>
              )}
              {modo === "mover-ambiente" && (
                <>
                  {" "}·{" "}
                  <label style={{ cursor: "pointer" }}>
                    <input type="checkbox" checked={engancheAutomatico} onChange={(e) => setEngancheAutomatico(e.target.checked)} style={{ marginRight: 4 }} />
                    Enganche automático (encaja contra otros ambientes y el borde del plano)
                  </label>
                </>
              )}
              {modo === "triangular" && (
                <>
                  {" "}·{" "}
                  {referenciasTriangulacion.length < 2
                    ? `${referenciasTriangulacion.length} de 2 referencias elegidas.`
                    : candidatosTriangulacion.length === 0
                      ? "2 referencias listas — completá las 2 distancias abajo."
                      : `${candidatosTriangulacion.length} punto(s) posible(s) — click aproximado en el plano para confirmar.`}
                  {referenciasTriangulacion.length > 0 && (
                    <>
                      {" "}
                      <button type="button" onClick={reiniciarTriangulacion} style={{ background: "none", border: "none", color: colores.copper, fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 11 }}>
                        Reiniciar
                      </button>
                    </>
                  )}
                </>
              )}
            </div>

            {modo === "triangular" && referenciasTriangulacion.length === 2 && candidatosTriangulacion.length === 0 && (
              <form onSubmit={calcularCandidatosTriangulacion} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 10, color: colores.textDim, marginBottom: 4 }}>Distancia real a la referencia 1 (m):</div>
                  <input
                    style={{ ...inputStyle(), width: 110 }}
                    type="number"
                    step="0.01"
                    autoFocus
                    value={distancia1TriangulacionInput}
                    onChange={(e) => setDistancia1TriangulacionInput(e.target.value)}
                    placeholder="Ej: 2.5"
                  />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: colores.textDim, marginBottom: 4 }}>Distancia real a la referencia 2 (m):</div>
                  <input
                    style={{ ...inputStyle(), width: 110 }}
                    type="number"
                    step="0.01"
                    value={distancia2TriangulacionInput}
                    onChange={(e) => setDistancia2TriangulacionInput(e.target.value)}
                    placeholder="Ej: 3.1"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!distancia1TriangulacionInput || !distancia2TriangulacionInput}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 3,
                    border: "none",
                    background: distancia1TriangulacionInput && distancia2TriangulacionInput ? colores.copper : colores.border,
                    color: distancia1TriangulacionInput && distancia2TriangulacionInput ? colores.textSobreAcento : colores.textDim,
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: distancia1TriangulacionInput && distancia2TriangulacionInput ? "pointer" : "not-allowed",
                  }}
                >
                  Calcular
                </button>
              </form>
            )}

            {(modo === "equipo" || modo === "triangular" || modo === "grupo_equipo") && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                {modo !== "grupo_equipo" && (
                  <select
                    value={equipoYaIngresadoSeleccionado}
                    onChange={(e) => alElegirEquipoYaIngresado(e.target.value)}
                    style={{ padding: "6px 8px", borderRadius: 3, border: `1px solid ${colores.copper}`, background: colores.bg, color: colores.textMain, fontSize: 12, maxWidth: 220 }}
                    title="Elegí un equipo que ya cargaste en Circuitos y resultados — el símbolo correcto se completa solo."
                  >
                    <option value="">¿Equipo ya ingresado?</option>
                    {equipos
                      .filter((e) => !marcadoresEquipoPlano.some((m) => m.entidadId === e.id))
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {etiquetaEntidadEquipo("contacto", e)}
                        </option>
                      ))}
                  </select>
                )}
                <select
                  value={tipoEquipoSeleccionado}
                  onChange={(e) => {
                    setTipoEquipoSeleccionado(e.target.value);
                    setEntidadEquipoNuevo("");
                    setEquipoYaIngresadoSeleccionado("");
                  }}
                  style={{ padding: "6px 8px", borderRadius: 3, border: `1px solid ${colores.border}`, background: colores.bg, color: colores.textMain, fontSize: 12 }}
                >
                  {Object.entries(categoriasEquipo).map(([cat, items]) => (
                    <optgroup key={cat} label={cat}>
                      {items.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <input
                  value={nombreEquipoNuevo}
                  onChange={(e) => setNombreEquipoNuevo(e.target.value)}
                  placeholder={modo === "grupo_equipo" ? "Nombre base (opcional, ej: Luz)" : "Nombre (opcional)"}
                  style={{ padding: "6px 8px", borderRadius: 3, border: `1px solid ${colores.border}`, background: colores.bg, color: colores.textMain, fontSize: 12, width: modo === "grupo_equipo" ? 190 : 140 }}
                />
                {modo === "grupo_equipo" && (
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={cantidadGrupoEquipo}
                    onChange={(e) => setCantidadGrupoEquipo(e.target.value)}
                    style={{ padding: "6px 8px", borderRadius: 3, border: `1px solid ${colores.border}`, background: colores.bg, color: colores.textMain, fontSize: 12, width: 70 }}
                    title="Cantidad a generar"
                  />
                )}
                {/* Vincular a una entidad no aplica a un GRUPO (serían N
                    marcadores compartiendo 1 solo vínculo) — cada uno se
                    vincula después, individualmente, desde la lista
                    "Equipos en el plano". */}
                {modo !== "grupo_equipo" && App.plano.obtenerComponente(tipoEquipoSeleccionado)?.entidadVinculada && (
                  <select
                    value={entidadEquipoNuevo}
                    onChange={(e) => setEntidadEquipoNuevo(e.target.value)}
                    style={{ padding: "6px 8px", borderRadius: 3, border: `1px solid ${colores.border}`, background: colores.bg, color: colores.textMain, fontSize: 12, maxWidth: 220 }}
                  >
                    <option value="">— Vincular a (opcional) —</option>
                    {App.plano
                      .candidatosEntidadEquipo(tipoEquipoSeleccionado, { tableros, equipos, circuitos, fuentesEnergia, transformadores, diferenciales, marcadores: marcadoresEquipoPlano })
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {etiquetaEntidadEquipo(tipoEquipoSeleccionado, c)}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            )}

            {modo === "grupo_circuito" && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                <select
                  value={circuitoGrupoSeleccionado}
                  onChange={(e) => setCircuitoGrupoSeleccionado(e.target.value)}
                  style={{ padding: "6px 8px", borderRadius: 3, border: `1px solid ${colores.copper}`, background: colores.bg, color: colores.textMain, fontSize: 12, maxWidth: 260 }}
                  title="Genera un marcador YA vinculado por cada equipo de este circuito — el tipo de símbolo se infiere solo."
                >
                  <option value="">¿Qué circuito?</option>
                  {circuitos.map((c) => {
                    const cantidad = equipos.filter((e) => e.circuitoId === c.id).length;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.etiqueta ? `${c.etiqueta} — ` : ""}
                        {c.nombre || "(sin nombre)"} ({cantidad} equipo{cantidad === 1 ? "" : "s"})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {modo === "ambiente" && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                <input
                  value={nombreAmbienteNuevo}
                  onChange={(e) => setNombreAmbienteNuevo(e.target.value)}
                  placeholder="Nombre (ej. Habitación #1)"
                  style={{ padding: "6px 8px", borderRadius: 3, border: `1px solid ${colores.border}`, background: colores.bg, color: colores.textMain, fontSize: 12, width: 170 }}
                />
                <input
                  type="number"
                  step="0.01"
                  value={anchoAmbienteInput}
                  onChange={(e) => setAnchoAmbienteInput(e.target.value)}
                  placeholder="Ancho (m)"
                  style={{ padding: "6px 8px", borderRadius: 3, border: `1px solid ${colores.border}`, background: colores.bg, color: colores.textMain, fontSize: 12, width: 90 }}
                />
                <span style={{ color: colores.textDim, fontSize: 12 }}>×</span>
                <input
                  type="number"
                  step="0.01"
                  value={altoAmbienteInput}
                  onChange={(e) => setAltoAmbienteInput(e.target.value)}
                  placeholder="Largo (m)"
                  style={{ padding: "6px 8px", borderRadius: 3, border: `1px solid ${colores.border}`, background: colores.bg, color: colores.textMain, fontSize: 12, width: 90 }}
                />
              </div>
            )}
          </>
        )}

        <PlanoCanvas
          ref={canvasRef}
          imagen={planoImagen}
          mostrarImagenFondo={capasVisibles.fondo}
          nodos={nodosPlano}
          segmentos={segmentosPlano.filter((s) => capasVisibles[s.tipo])}
          marcadoresEquipo={capasVisibles.equipos ? marcadoresEquipoPlano : []}
          habitaciones={habitacionesPlano}
          escalaMetrosPorPixel={planoCalibracion?.escalaMetrosPorPixel ?? null}
          puntosGuiaPendientes={
            modo === "perspectiva"
              ? puntosPerspectiva
              : modo === "calibrar-perimetro"
                ? puntosContornoCalibracion
                : modo === "espesor"
                  ? puntosEspesor
                  : modo === "triangular"
                    ? referenciasTriangulacion.map((r) => App.plano.modeloAImagen(r.punto, planoCalibracion.escalaMetrosPorPixel))
                    : puntosCalibracion
          }
          nodoIdsTrazoActual={trazoActual}
          modo={modo}
          onArrastrarHabitacion={(habitacionId, deltaM) => moverHabitacionPlano(habitacionId, deltaM, engancheAutomatico)}
          onIniciarArrastre={iniciarArrastrePlano}
          onArrastrarMarcador={moverMarcadorEquipoPlano}
          onTrazarRectangulo={alTrazarRectangulo}
          asistenciaBordes={asistenciaBordes}
          onClickImagen={alClickImagen}
          onClickMarcador={alClickMarcador}
          paredesCandidatas={paredesCandidatas}
          puertasCandidatas={puertasCandidatas}
          onClickParedCandidata={aceptarParedCandidata}
          candidatosTriangulacion={
            modo === "triangular" && planoCalibracion
              ? candidatosTriangulacion.map((c) => App.plano.modeloAImagen(c, planoCalibracion.escalaMetrosPorPixel))
              : []
          }
        />

        {modo === "perspectiva" && puntosPerspectiva.length === 4 && (
          <form onSubmit={confirmarPerspectiva} style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 10, color: colores.textDim, marginBottom: 4 }}>Ancho real del rectángulo (m):</div>
              <input style={{ ...inputStyle(), width: 110 }} type="number" step="0.01" autoFocus value={anchoRealInput} onChange={(e) => setAnchoRealInput(e.target.value)} placeholder="Ej: 4" />
            </div>
            <div>
              <div style={{ fontSize: 10, color: colores.textDim, marginBottom: 4 }}>Largo real del rectángulo (m):</div>
              <input style={{ ...inputStyle(), width: 110 }} type="number" step="0.01" value={altoRealInput} onChange={(e) => setAltoRealInput(e.target.value)} placeholder="Ej: 3" />
            </div>
            <button
              type="submit"
              disabled={!anchoRealInput || !altoRealInput || corrigiendoPerspectiva}
              style={{
                padding: "8px 16px",
                borderRadius: 3,
                border: "none",
                background: anchoRealInput && altoRealInput && !corrigiendoPerspectiva ? colores.copper : colores.border,
                color: anchoRealInput && altoRealInput && !corrigiendoPerspectiva ? colores.textSobreAcento : colores.textDim,
                fontWeight: 700,
                fontSize: 12.5,
                cursor: anchoRealInput && altoRealInput && !corrigiendoPerspectiva ? "pointer" : "not-allowed",
              }}
            >
              {corrigiendoPerspectiva ? "Corrigiendo…" : "Corregir perspectiva"}
            </button>
            <button
              type="button"
              onClick={() => setPuntosPerspectiva([])}
              style={{ padding: "8px 12px", background: "transparent", color: colores.textDim, border: `1px solid ${colores.border}`, borderRadius: 3, fontSize: 12.5, cursor: "pointer" }}
            >
              Cancelar
            </button>
          </form>
        )}

        {modo === "calibrar" && puntosCalibracion.length === 2 && (
          <form onSubmit={confirmarCalibracion} style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: colores.textDim, marginBottom: 4 }}>Distancia real entre esos dos puntos (metros):</div>
              <input
                style={inputStyle()}
                type="number"
                step="0.01"
                autoFocus
                value={distanciaRealInput}
                onChange={(e) => setDistanciaRealInput(e.target.value)}
                placeholder="Ej: 5"
              />
            </div>
            <button
              type="submit"
              disabled={!distanciaRealInput}
              style={{ padding: "8px 16px", borderRadius: 3, border: "none", background: distanciaRealInput ? colores.copper : colores.border, color: distanciaRealInput ? colores.textSobreAcento : colores.textDim, fontWeight: 700, fontSize: 12.5, cursor: distanciaRealInput ? "pointer" : "not-allowed" }}
            >
              Calibrar
            </button>
            <button
              type="button"
              onClick={() => setPuntosCalibracion([])}
              style={{ padding: "8px 12px", background: "transparent", color: colores.textDim, border: `1px solid ${colores.border}`, borderRadius: 3, fontSize: 12.5, cursor: "pointer" }}
            >
              Cancelar
            </button>
          </form>
        )}

        {modo === "calibrar-perimetro" && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10.5, color: colores.textDim, marginBottom: 4 }}>
              {puntosContornoCalibracion.length} punto{puntosContornoCalibracion.length !== 1 ? "s" : ""} trazado{puntosContornoCalibracion.length !== 1 ? "s" : ""}
              {puntosContornoCalibracion.length < 3 && " — agregá al menos 3 para declarar el perímetro."}
            </div>
            <div style={{ fontSize: 10.5, color: colores.warn, marginBottom: 8 }}>
              ⚠ Ojo: es el <strong>perímetro</strong> (metros LINEALES alrededor del contorno), no el área total del plano (m²) — son datos distintos, fácil de confundir si tu plano muestra la superficie construida bien grande. Si tenés una medida de un tramo recto marcada en el plano (ej. "12.50 m"), usar "Calibrar" (2 puntos) en vez de esto es más preciso.
            </div>
            {puntosContornoCalibracion.length >= 3 && (
              <form onSubmit={confirmarCalibracionPerimetro} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: colores.textDim, marginBottom: 4 }}>Perímetro real de ese contorno (metros):</div>
                  <input
                    style={inputStyle()}
                    type="number"
                    step="0.01"
                    autoFocus
                    value={perimetroRealInput}
                    onChange={(e) => setPerimetroRealInput(e.target.value)}
                    placeholder="Ej: 60"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!perimetroRealInput}
                  style={{ padding: "8px 16px", borderRadius: 3, border: "none", background: perimetroRealInput ? colores.copper : colores.border, color: perimetroRealInput ? colores.textSobreAcento : colores.textDim, fontWeight: 700, fontSize: 12.5, cursor: perimetroRealInput ? "pointer" : "not-allowed" }}
                >
                  Calibrar
                </button>
              </form>
            )}
            <button
              type="button"
              onClick={() => setPuntosContornoCalibracion([])}
              style={{ marginTop: 8, padding: "6px 12px", background: "transparent", color: colores.textDim, border: `1px solid ${colores.border}`, borderRadius: 3, fontSize: 11.5, cursor: "pointer" }}
            >
              Reiniciar trazo
            </button>
          </div>
        )}

        {modo === "espesor" && (
          <div style={{ fontSize: 10.5, color: colores.textDim, marginTop: 10 }}>
            {puntosEspesor.length === 0 ? "Click en un lado de la pared." : "Click en el otro lado de la pared."}
          </div>
        )}

        {planoCalibracion && (
          <div style={{ fontSize: 10.5, color: colores.textDim, marginTop: 10 }}>
            {planoCalibracion.metodo === "perimetro" ? (
              <>
                Calibrado por perímetro: {planoCalibracion.perimetroRealM}m real
              </>
            ) : (
              <>
                Calibrado: {planoCalibracion.distanciaRealM}m = {Math.round(planoCalibracion.distanciaRealM / planoCalibracion.escalaMetrosPorPixel)}px de imagen
              </>
            )}
            {" "}({planoCalibracion.escalaMetrosPorPixel.toFixed(5)} m/px).{" "}
            <button type="button" onClick={() => cambiarModo("calibrar")} style={{ background: "none", border: "none", color: colores.copper, fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 10.5 }}>Recalibrar</button>
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <span title="Piso a viga corona/encofrado — dato real distinto del ancho/largo en planta, para el tramo vertical del conductor hacia tomas e interruptores.">
                Altura de techo general (m):
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={alturaTechoPlanoM ?? ""}
                onChange={(e) => establecerAlturaTechoPlano(e.target.value)}
                placeholder="Ej: 2.4"
                style={{ ...inputStyle(), width: 70, padding: "3px 6px", fontSize: 10.5 }}
              />
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 11, color: colores.textDim, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Ambientes ({habitacionesPlano.length})
            </div>
            {nodosPlano.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const nuevos = detectarAmbientesPlano();
                  mostrarAviso(
                    nuevos > 0
                      ? `${nuevos} ambiente${nuevos === 1 ? "" : "s"} nuevo${nuevos === 1 ? "" : "s"} detectado${nuevos === 1 ? "" : "s"} a partir de las paredes trazadas.`
                      : "No se encontró ningún ambiente nuevo — ¿las paredes ya forman un lazo cerrado?"
                  );
                }}
                title="Analiza TODAS las paredes trazadas y registra cada ambiente cerrado que encuentre — incluidos los que una pared interior separa de otro, sin tener que volver a trazarlos a mano."
                style={{ padding: "5px 10px", borderRadius: 3, border: `1px solid ${colores.copper}`, background: "transparent", color: colores.copper, fontWeight: 600, fontSize: 11, cursor: "pointer" }}
              >
                Detectar ambientes automáticamente
              </button>
            )}
          </div>
          {habitacionesPlano.length === 0 ? (
            <div style={{ fontSize: 12, color: colores.textDim, lineHeight: 1.4 }}>
              Cerrá un trazo de pared (volvé al punto de inicio) para que aparezca acá, con su área y perímetro ya calculados — o trazá varios cuartos compartiendo paredes y usá "Detectar ambientes automáticamente".
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {habitacionesPlano.map((h) => (
                <div key={h.id} style={{ border: `1px solid ${colores.border}`, borderRadius: 3, padding: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <input
                      style={{ ...inputStyle(), flex: 1, padding: "4px 6px", fontSize: 12 }}
                      value={h.nombre}
                      onChange={(e) => renombrarHabitacionPlano(h.id, e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => eliminarHabitacionPlano(h.id)}
                      style={{ background: "none", border: "none", color: colores.textDim, cursor: "pointer", fontSize: 14 }}
                      aria-label={`Eliminar ${h.nombre}`}
                    >
                      ×
                    </button>
                  </div>
                  <div style={{ fontFamily: fuentes.mono, fontSize: 11.5, color: colores.textDim }}>
                    {h.areaM2.toFixed(2)} m² · perímetro {h.perimetroM.toFixed(2)} m
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 10.5, color: colores.textDim }} title="Deja vacío para usar la altura general del plano.">
                      Altura propia (m):
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={h.alturaM ?? ""}
                      onChange={(e) => editarAlturaHabitacionPlano(h.id, e.target.value)}
                      placeholder={alturaTechoPlanoM != null ? `gral. ${alturaTechoPlanoM}` : "—"}
                      style={{ ...inputStyle(), width: 70, padding: "3px 6px", fontSize: 10.5 }}
                    />
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, color: colores.textDim, cursor: "pointer", marginLeft: 6 }} title="Instalación de exteriores (intemperie) — ej. cobertizo, patio, cuarto de bomba separado.">
                      <input type="checkbox" checked={h.exterior} onChange={(e) => editarExteriorHabitacionPlano(h.id, e.target.checked)} />
                      Exterior
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: 14 }}>
          <div style={{ fontSize: 11, color: colores.textDim, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
            Rutas de conductor ({rutasConductorPlano.length})
          </div>
          {planoCalibracion && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              <select
                value={circuitoRutaAutoSeleccionado}
                onChange={(e) => setCircuitoRutaAutoSeleccionado(e.target.value)}
                style={{ padding: "5px 8px", borderRadius: 3, border: `1px solid ${colores.border}`, background: colores.bg, color: colores.textMain, fontSize: 11.5, maxWidth: 200 }}
              >
                <option value="">¿Sugerir ruta para qué circuito?</option>
                {circuitos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.etiqueta ? `${c.etiqueta} — ` : ""}
                    {c.nombre || "(sin nombre)"}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!circuitoRutaAutoSeleccionado}
                onClick={() => {
                  const resultado = generarRutasAutomaticasCircuito(circuitoRutaAutoSeleccionado);
                  if (resultado?.sinTablero) {
                    mostrarAviso("Ese circuito no tiene un tablero vinculado a un marcador en el plano todavía — colocalo primero con \"Colocar equipo\".");
                    return;
                  }
                  const generadas = resultado?.generadas.length ?? 0;
                  const sinCamino = resultado?.sinCamino ?? [];
                  let texto =
                    generadas > 0
                      ? `${generadas} ruta(s) generada(s) siguiendo la red de conductores ya trazada.`
                      : "No se generó ninguna ruta.";
                  if (sinCamino.length > 0) {
                    texto += ` Sin conexión encontrada para: ${sinCamino.join(", ")} — colocá su marcador y/o trazá conductor hasta cerca de él.`;
                  }
                  mostrarAviso(texto);
                }}
                title="Busca, para cada equipo de este circuito, el camino más corto SOBRE los conductores que ya trazaste a mano — nunca inventa una conexión recta."
                style={{ padding: "5px 10px", borderRadius: 3, border: `1px solid ${colores.copper}`, background: "transparent", color: circuitoRutaAutoSeleccionado ? colores.copper : colores.textDim, fontWeight: 600, fontSize: 11, cursor: circuitoRutaAutoSeleccionado ? "pointer" : "not-allowed" }}
              >
                Sugerir ruta automática
              </button>
            </div>
          )}
          {rutasConductorPlano.length === 0 ? (
            <div style={{ fontSize: 12, color: colores.textDim, lineHeight: 1.4 }}>
              Trazá el recorrido de un conductor ("Trazar conductor") y terminalo para que aparezca acá, con su longitud ya calculada.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rutasConductorPlano.map((r) => {
                // Motor geométrico de cruces de pared (usuario, 2026-11-22):
                // cuánto conducto EXTRA agrega cada pared que esta ruta
                // cruza, calculado del espesorM ya medido + el ángulo real
                // del cruce — ver modules/plano/cruceParedes.ts. Segmentos
                // de tipo "pared" únicamente (una ruta nunca "cruza" otra
                // ruta de conductor en este cálculo).
                const segmentosPared = segmentosPlano.filter((s) => s.tipo === "pared");
                const cruces = App.plano.calcularCrucesPared(r, nodosPlano, segmentosPared);
                return (
                  <div key={r.id} style={{ border: `1px solid ${colores.border}`, borderRadius: 3, padding: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <input
                        style={{ ...inputStyle(), flex: 1, padding: "4px 6px", fontSize: 12 }}
                        value={r.nombre}
                        onChange={(e) => renombrarRutaConductorPlano(r.id, e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => eliminarRutaConductorPlano(r.id)}
                        style={{ background: "none", border: "none", color: colores.textDim, cursor: "pointer", fontSize: 14 }}
                        aria-label={`Eliminar ${r.nombre}`}
                      >
                        ×
                      </button>
                    </div>
                    <div style={{ fontFamily: fuentes.mono, fontSize: 11.5, color: colores.textDim }}>
                      longitud trazada {r.longitudM.toFixed(2)} m
                      {cruces.cruces.length > 0 && (
                        <>
                          {" "}
                          · +{cruces.extraTotalM.toFixed(2)} m por {cruces.cruces.length} cruce{cruces.cruces.length !== 1 ? "s" : ""} de pared ·{" "}
                          <strong style={{ color: colores.textMain }}>total {cruces.longitudTotalM.toFixed(2)} m</strong>
                        </>
                      )}
                    </div>
                    {cruces.paredesSinEspesor.length > 0 && (
                      <div style={{ fontSize: 10.5, color: colores.warn, marginTop: 2 }}>
                        ⚠ Cruza {cruces.paredesSinEspesor.length} pared{cruces.paredesSinEspesor.length !== 1 ? "es" : ""} sin espesor medido — medí su ancho para incluirlo en el total.
                      </div>
                    )}
                    {cruces.paredesAnguloIndeterminado.length > 0 && (
                      <div style={{ fontSize: 10.5, color: colores.warn, marginTop: 2 }}>
                        ⚠ Cruza {cruces.paredesAnguloIndeterminado.length} pared{cruces.paredesAnguloIndeterminado.length !== 1 ? "es" : ""} en un ángulo demasiado rasante para calcular el extra con confianza.
                      </div>
                    )}

                    {/* Autocompletar distancia (usuario, 2026-11-22: "autocompletar la
                        distancia del circuito/alimentador desde la longitud ya trazada en
                        el plano") — vínculo opcional a un circuito o tablero YA existente;
                        "Usar esta longitud" copia el valor UNA vez al campo real (no un
                        sincronizado permanente, ver nota de vincularRutaConductorPlano). */}
                    {(() => {
                      const candidatos = App.plano.candidatosEntidadRuta({ circuitos, tableros, rutas: rutasConductorPlano, rutaId: r.id });
                      const entidad = App.plano.resolverEntidadRuta(r, { circuitos, tableros });
                      return (
                        <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${colores.border}` }}>
                          <select
                            style={{ ...inputStyle(), padding: "4px 6px", fontSize: 11, width: "100%" }}
                            value={r.entidadId ? `${r.entidadTipo}:${r.entidadId}` : ""}
                            onChange={(e) => {
                              if (!e.target.value) return vincularRutaConductorPlano(r.id, null, null);
                              const [tipo, id] = e.target.value.split(":");
                              vincularRutaConductorPlano(r.id, id, tipo);
                            }}
                          >
                            <option value="">— Vincular a (opcional) —</option>
                            {candidatos.circuitos.length > 0 && (
                              <optgroup label="Circuitos (distancia)">
                                {candidatos.circuitos.map((c) => (
                                  <option key={c.id} value={`circuito:${c.id}`}>
                                    {c.nombre || "(sin nombre)"}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {candidatos.tableros.length > 0 && (
                              <optgroup label="Tableros (alimentador)">
                                {candidatos.tableros.map((t) => (
                                  <option key={t.id} value={`tablero:${t.id}`}>
                                    {t.nombre}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                          {entidad && (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 4, fontSize: 11, color: colores.textDim }}>
                              <span>
                                Distancia actual: {Number(r.entidadTipo === "circuito" ? entidad.distancia : entidad.longitudAlimentador || 0).toFixed(2)} m
                              </span>
                              <button
                                type="button"
                                onClick={() => aplicarLongitudRutaPlano(r.id)}
                                style={{ background: "none", border: "none", color: colores.copper, fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 11 }}
                              >
                                Usar esta longitud ({cruces.longitudTotalM.toFixed(2)} m)
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: 14 }}>
          <div style={{ fontSize: 11, color: colores.textDim, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
            Equipos en el plano ({marcadoresEquipoPlano.length})
          </div>
          {marcadoresEquipoPlano.length === 0 ? (
            <div style={{ fontSize: 12, color: colores.textDim, lineHeight: 1.4 }}>
              Elegí "Colocar equipo", el tipo que corresponda, y hacé click en su ubicación dentro del plano.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {marcadoresEquipoPlano.map((m) => {
                const comp = App.plano.obtenerComponente(m.tipo);
                const entidad = App.plano.resolverEntidadEquipo(m, { tableros, equipos, circuitos, fuentesEnergia, transformadores, diferenciales });
                const candidatos = App.plano.candidatosEntidadEquipo(m.tipo, { tableros, equipos, circuitos, fuentesEnergia, transformadores, diferenciales, marcadores: marcadoresEquipoPlano, marcadorId: m.id });
                // Interior/exterior (usuario, 2026-11-25): se DERIVA del
                // ambiente que contiene al marcador, nunca se guarda
                // aparte en el equipo — si el ambiente cambia, el
                // equipo sigue el cambio solo, sin re-marcar nada.
                const ambienteDelEquipo = App.plano.habitacionQueContiene(m.punto, habitacionesPlano, nodosPlano);
                return (
                  <div key={m.id} style={{ border: `1px solid ${colores.border}`, borderRadius: 3, padding: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLOR_POR_CATEGORIA[comp?.categoria] ?? colores.border, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 12, color: colores.textMain }}>{comp?.nombre ?? m.tipo}</div>
                      <span
                        style={{ fontSize: 9.5, color: ambienteDelEquipo ? (ambienteDelEquipo.exterior ? colores.warn : colores.textDim) : colores.textDim, border: `1px solid ${colores.border}`, borderRadius: 3, padding: "1px 5px", textTransform: "uppercase", letterSpacing: "0.03em" }}
                        title={ambienteDelEquipo ? `Dentro de "${ambienteDelEquipo.nombre}"` : "No cae dentro de ningún ambiente trazado"}
                      >
                        {ambienteDelEquipo ? (ambienteDelEquipo.exterior ? "Exterior" : "Interior") : "Sin ambiente"}
                      </span>
                      <button
                        type="button"
                        onClick={() => eliminarMarcadorEquipoPlano(m.id)}
                        style={{ background: "none", border: "none", color: colores.textDim, cursor: "pointer", fontSize: 14 }}
                        aria-label={`Eliminar ${comp?.nombre ?? m.tipo}`}
                      >
                        ×
                      </button>
                    </div>
                    <input
                      style={{ ...inputStyle(), width: "100%", padding: "4px 6px", fontSize: 11.5, marginBottom: comp?.entidadVinculada ? 4 : 0 }}
                      value={m.nombre}
                      placeholder="Nombre (opcional)"
                      onChange={(e) => editarMarcadorEquipoPlano(m.id, { nombre: e.target.value })}
                    />
                    {comp?.entidadVinculada && (
                      <select
                        value={m.entidadId ?? ""}
                        onChange={(e) => editarMarcadorEquipoPlano(m.id, { entidadId: e.target.value || null })}
                        style={{ width: "100%", padding: "4px 6px", borderRadius: 3, border: `1px solid ${colores.border}`, background: colores.bg, color: colores.textMain, fontSize: 11.5 }}
                      >
                        <option value="">— Sin vincular —</option>
                        {entidad && !candidatos.some((c) => c.id === entidad.id) && (
                          <option value={entidad.id}>{etiquetaEntidadEquipo(m.tipo, entidad)}</option>
                        )}
                        {candidatos.map((c) => (
                          <option key={c.id} value={c.id}>
                            {etiquetaEntidadEquipo(m.tipo, c)}
                          </option>
                        ))}
                      </select>
                    )}
                    {m.tipo === "interruptor_conmutado" && (() => {
                      // Vínculo marcador-a-marcador (usuario, 2026-11-25):
                      // qué luminaria controla este interruptor conmutado —
                      // puramente geográfico/de plano, no es una entidad del
                      // sistema. Varios interruptores pueden apuntar a la
                      // misma luminaria (escalera a 3/4 vías), a propósito.
                      const luminarias = marcadoresEquipoPlano.filter((otro) => otro.tipo.startsWith("luminaria"));
                      const luminariaVinculada = luminarias.find((l) => l.id === m.controlaMarcadorId);
                      return (
                        <select
                          value={m.controlaMarcadorId ?? ""}
                          onChange={(e) => editarMarcadorEquipoPlano(m.id, { controlaMarcadorId: e.target.value || null })}
                          style={{ width: "100%", padding: "4px 6px", marginTop: 4, borderRadius: 3, border: `1px solid ${colores.border}`, background: colores.bg, color: colores.textMain, fontSize: 11.5 }}
                        >
                          <option value="">— Controla la luminaria: sin vincular —</option>
                          {luminariaVinculada === undefined && m.controlaMarcadorId && (
                            <option value={m.controlaMarcadorId}>(luminaria eliminada)</option>
                          )}
                          {luminarias.map((l) => (
                            <option key={l.id} value={l.id}>
                              Controla: {l.nombre || App.plano.obtenerComponente(l.tipo)?.nombre || l.tipo}
                            </option>
                          ))}
                        </select>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Segmento más cercano a un punto (modelo, metros) — distancia punto-a-segmento mínima. */
function segmentoMasCercano(puntoModelo, nodos, segmentos) {
  let mejor = null;
  let menorDistancia = Infinity;
  for (const seg of segmentos) {
    const a = nodos.find((n) => n.id === seg.nodoAId)?.punto;
    const b = nodos.find((n) => n.id === seg.nodoBId)?.punto;
    if (!a || !b) continue;
    const d = distanciaPuntoSegmento(puntoModelo, a, b);
    if (d < menorDistancia) {
      menorDistancia = d;
      mejor = seg;
    }
  }
  // Tolerancia fija en metros (30cm) — independiente del zoom, igual
  // criterio que RADIO_SNAP_METROS en modules/plano/index.js.
  return menorDistancia <= 0.3 ? mejor : null;
}

function distanciaPuntoSegmento(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const largo2 = dx * dx + dy * dy;
  if (largo2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / largo2;
  t = Math.max(0, Math.min(1, t));
  const proyX = a.x + t * dx;
  const proyY = a.y + t * dy;
  return Math.hypot(p.x - proyX, p.y - proyY);
}
