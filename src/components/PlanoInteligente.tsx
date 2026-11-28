import { Fragment, useRef, useState, useMemo, type FormEvent, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { colores, fuentes } from "../styles/colores.ts";
import { inputStyle } from "./Campo.tsx";
import { BotonPill } from "./PanelTableros.tsx";
import PlanoCanvas, { type PlanoCanvasHandle } from "./PlanoCanvas.tsx";
import { ApplicationMediator as App } from "../core/ApplicationMediator.ts";
import type { useCircuitos } from "../hooks/useCircuitos.ts";
import type { Punto, LineaCandidata, EntidadVinculadaRuta, MarcadorEquipoPlano, NodoPlano, SegmentoPlano } from "../modules/plano/tipos.ts";
import type { TipoAmbiente } from "../modules/plano/tipoAmbiente.ts";

type RetornoHook = ReturnType<typeof useCircuitos>;

type PlanoInteligenteProps = Pick<
  RetornoHook,
  | "planoImagen"
  | "cargarImagenPlano"
  | "quitarImagenPlano"
  | "restablecerPlano"
  | "deshacerPlano"
  | "puedeDeshacerPlano"
  | "iniciarArrastrePlano"
  | "planoCalibracion"
  | "calibrarPlano"
  | "calibrarPlanoPorPerimetro"
  | "alturaTechoPlanoM"
  | "establecerAlturaTechoPlano"
  | "nodosPlano"
  | "segmentosPlano"
  | "agregarNodoPlano"
  | "agregarSegmentoPlano"
  | "eliminarNodoPlano"
  | "eliminarSegmentoPlano"
  | "editarSegmentoPlano"
  | "habitacionesPlano"
  | "cerrarHabitacionPlano"
  | "detectarAmbientesPlano"
  | "eliminarHabitacionPlano"
  | "renombrarHabitacionPlano"
  | "editarAlturaHabitacionPlano"
  | "editarExteriorHabitacionPlano"
  | "editarTipoAmbienteHabitacionPlano"
  | "generarHabitacionPlano"
  | "generarHabitacionPorArrastre"
  | "moverHabitacionPlano"
  | "rutasConductorPlano"
  | "cerrarRutaConductorPlano"
  | "eliminarRutaConductorPlano"
  | "renombrarRutaConductorPlano"
  | "vincularRutaConductorPlano"
  | "generarRutasAutomaticasCircuito"
  | "entidadesPorCajaEmpalme"
  | "aplicarLongitudRutaPlano"
  | "marcadoresEquipoPlano"
  | "agregarMarcadorEquipoPlano"
  | "editarMarcadorEquipoPlano"
  | "eliminarMarcadorEquipoPlano"
  | "moverMarcadorEquipoPlano"
  | "generarGrupoMarcadoresEquipoPlano"
  | "generarCircuitoMarcadoresEquipoPlano"
  | "corregirPerspectivaPlano"
  | "crearPlanoSinImagen"
  | "exportarDXFPlano"
  | "tableros"
  | "equipos"
  | "circuitos"
  | "fuentesEnergia"
  | "transformadores"
  | "diferenciales"
  | "advertenciasGFCI"
  | "advertenciasAFCI"
  | "advertenciasVolumenBano"
>;

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
// `cambiarModo` no cambia — solo se agrega `grupo`, que el render usa
// como una pequeña etiqueta separadora INLINE (nunca fuerza su propia
// fila — ver la nota en el render de la barra de modos, sobre por qué
// una primera versión con una fila fija por grupo empujaba el lienzo
// del plano fuera de la vista en pantallas bajas).
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

// Categorías del menú colapsable de pantalla completa (usuario,
// 2026-11-26: "cuando toque el menú despliega un menú que contenga
// apartados... ambiente lo tocas y muestra todos los botones
// relacionado con esa función") — los MISMOS 5 grupos que ya agrupan
// la fila de escritorio, sin inventar una taxonomía nueva, solo
// reusando `grupo` en un acordeón en vez de una fila plana.
const CATEGORIAS_MODOS = [...new Set(MODOS.map((m) => m.grupo))];

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
  entidadesPorCajaEmpalme = {},
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
  advertenciasGFCI = [],
  advertenciasAFCI = [],
  advertenciasVolumenBano = [],
}: PlanoInteligenteProps) {
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
  const canvasRef = useRef<PlanoCanvasHandle>(null);
  // Pantalla completa táctil (usuario, 2026-11-26, "al entrar a editar
  // se expande a pantalla completa... todas las funciones agrupadas en
  // un botón que puedes expandir o retraer", confirmado Android). Dos
  // capas independientes, a propósito: (1) un modo CSS propio
  // (position:fixed cubriendo el viewport) que SIEMPRE funciona, sin
  // depender de ninguna API del navegador — es la fuente de verdad del
  // layout; (2) un intento best-effort de la Fullscreen API real +
  // bloqueo de orientación horizontal, que en iPhone/Safari ni existe
  // (Element.requestFullscreen no está soportado ahí) — si fallan o no
  // existen, el modo (1) sigue andando igual, por eso van en try/catch
  // silenciosos, nunca condicionan nada del estado React.
  const contenedorPlanoRef = useRef<HTMLDivElement>(null);
  const [pantallaCompletaPlano, setPantallaCompletaPlano] = useState(false);
  const [menuPlanoExpandido, setMenuPlanoExpandido] = useState(true);
  // Acordeón de categorías del drawer de pantalla completa (ver
  // CATEGORIAS_MODOS) — null = ninguna categoría abierta todavía.
  const [categoriaMenuAbierta, setCategoriaMenuAbierta] = useState<string | null>(null);
  const [paredesCandidatas, setParedesCandidatas] = useState<LineaCandidata[]>([]);
  const [puertasCandidatas, setPuertasCandidatas] = useState<LineaCandidata[]>([]);
  // Asistencia de bordes (Fase 2) — "pega" cada click de trazado al
  // borde más fuerte cercano en la imagen, ver PlanoCanvas.jsx /
  // modules/plano/deteccionBordes.js. Preferencia de herramienta, NO
  // se persiste (no es un dato del proyecto, es solo cómo trabaja
  // ahora mismo quien está trazando).
  const [asistenciaBordes, setAsistenciaBordes] = useState(true);
  // Snap de ángulo al trazar pared/conductor (usuario, 2026-11-25/26,
  // "¿cómo tener trazos más limpios?") — mismo criterio que
  // asistenciaBordes: preferencia de herramienta, NO se persiste.
  // Prendido por defecto; "pega" el siguiente punto del trazo a la
  // horizontal/vertical/diagonal más cercana (cada 15°) SOLO si el
  // ángulo real ya está bastante cerca (ver SNAP_ANGULO_TOLERANCIA_GRADOS
  // en modules/geometria/index.ts) — nunca fuerza un trazo que el
  // instalador quiso en un ángulo cualquiera a propósito.
  const [snapAngulo, setSnapAngulo] = useState(true);

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
  const [puntosCalibracion, setPuntosCalibracion] = useState<Punto[]>([]);
  const [distanciaRealInput, setDistanciaRealInput] = useState("");

  // Calibración alternativa por perímetro (usuario, 2026-11-20): el
  // instalador traza un contorno de N puntos (no un grafo persistido,
  // efímero — igual criterio que puntosCalibracion) y, con 3 o más,
  // puede declarar el perímetro real total en vez de una distancia
  // puntual entre 2 esquinas.
  const [puntosContornoCalibracion, setPuntosContornoCalibracion] = useState<Punto[]>([]);
  const [perimetroRealInput, setPerimetroRealInput] = useState("");

  // Medir espesor de pared (usuario, 2026-11-20): 2 clicks a los dos
  // lados del ancho visible de una pared YA trazada — la distancia
  // entre esos 2 puntos, convertida a metros con la escala actual, se
  // guarda como espesorM de la pared más cercana al punto medio de
  // esos 2 clicks (nunca se adivina CUÁL pared si no hay ninguna cerca).
  const [puntosEspesor, setPuntosEspesor] = useState<Punto[]>([]);

  // Corrección de perspectiva — 4 puntos (esquinas del rectángulo real
  // en la foto), en orden; al completar los 4 se pide ancho/alto real.
  const [puntosPerspectiva, setPuntosPerspectiva] = useState<Punto[]>([]);
  const [anchoRealInput, setAnchoRealInput] = useState("");
  const [altoRealInput, setAltoRealInput] = useState("");
  const [corrigiendoPerspectiva, setCorrigiendoPerspectiva] = useState(false);

  // Trazo de pared (o de conductor, mismo mecanismo — ver modo
  // "conductor") en curso — lista ORDENADA de ids de nodo. Se resetea
  // al cambiar de modo o al cerrar/terminar el trazo.
  const [trazoActual, setTrazoActual] = useState<string[]>([]);
  // Nombre del ambiente al tocarlo (usuario, 2026-11-27, probando el
  // .zip en su PC: "cumple un rol informativo para el instalador, así
  // localiza y realiza los cambios que quiera más fácil"). Vive en modo
  // "Mover vista" a propósito — un click ahí, sin arrastre, no hacía
  // absolutamente nada hasta ahora (el modo neutro/de revisión, nunca
  // dispara ninguna creación/edición de dato), así que agregar esto acá
  // no le quita ningún comportamiento a nada que ya existiera.
  const [habitacionResaltadaId, setHabitacionResaltadaId] = useState<string | null>(null);

  // ID del circuito junto a cada equipo real (usuario, 2026-11-27,
  // cerrando la discusión sobre qué símbolos merece ver un electricista
  // en el plano: "en el plano solo se observará tomacorrientes, puntos
  // de luces con sus interruptores y motores... el ID señala qué
  // equipo o circuito se encuentra vinculado"). Puramente derivado —
  // NO reemplaza ni borra el marcador "Circuito (PIA)" existente (sigue
  // existiendo para quien ya lo colocó, "Generar circuito" lo sigue
  // generando) — esto es información ADICIONAL sobre el marcador del
  // equipo real, nunca un dato nuevo guardado. Solo markers cuyo tipo
  // tiene entidadVinculada "equipo" (contacto/luminaria/motor, nunca
  // "interruptor" suelto: no tiene forma de saber a qué circuito
  // pertenece) + "interruptor_conmutado" (vía controlaMarcadorId, la
  // luminaria que controla) — "puntos de luces CON SUS interruptores"
  // explícitamente pedido así.
  const etiquetaCircuitoPorMarcadorId = useMemo(() => {
    function etiquetaDelEquipo(equipoId: string) {
      const equipo = equipos.find((e) => e.id === equipoId);
      const circuito = equipo?.circuitoId ? circuitos.find((c) => c.id === equipo.circuitoId) : null;
      return circuito ? circuito.etiqueta || circuito.nombre || null : null;
    }
    const resultado: Record<string, string> = {};
    for (const m of marcadoresEquipoPlano) {
      const comp = App.plano.obtenerComponente(m.tipo);
      if (comp?.entidadVinculada === "equipo" && m.entidadId) {
        const etiqueta = etiquetaDelEquipo(m.entidadId);
        if (etiqueta) resultado[m.id] = etiqueta;
        continue;
      }
      if (m.tipo === "interruptor_conmutado" && m.controlaMarcadorId) {
        const luminaria = marcadoresEquipoPlano.find((otro) => otro.id === m.controlaMarcadorId);
        if (luminaria?.entidadId) {
          const etiqueta = etiquetaDelEquipo(luminaria.entidadId);
          if (etiqueta) resultado[m.id] = etiqueta;
        }
      }
    }
    return resultado;
  }, [marcadoresEquipoPlano, equipos, circuitos]);

  // Modo "equipo" — tipo/nombre/entidad elegidos ANTES de hacer click
  // en el plano (el click solo define la UBICACIÓN); mismo catálogo
  // que el diagrama unifilar (ver PlanoMediator.componentesPorCategoria).
  const categoriasEquipo = App.plano.componentesPorCategoriaPlano();
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

  function alElegirEquipoYaIngresado(equipoId: string) {
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
  // Origen alternativo (usuario, 2026-11-26, "...y sea el punto de
  // arranque real"): opcional, el id de un marcador "caja_empalme" ya
  // colocado — "" = comportamiento de siempre, arranca del tablero del
  // circuito.
  const [origenRutaAutoSeleccionado, setOrigenRutaAutoSeleccionado] = useState("");

  // Triangulación por recorrido (usuario, 2026-11-21): ubicar un
  // equipo sin tocar la imagen directamente — click en 2 puntos de
  // referencia YA existentes (nodo del grafo o equipo ya marcado),
  // declarar las 2 distancias reales medidas con cinta métrica, y
  // confirmar cuál de las 1-2 soluciones geométricas es la correcta
  // con un click aproximado. El equipo recién ubicado queda disponible
  // como referencia para el siguiente (ver alClickImagen, modo
  // "triangular" y marcadorCercano más abajo) — así se "recorre" el
  // sitio encadenando puntos, sin volver siempre a los 2 originales.
  const [referenciasTriangulacion, setReferenciasTriangulacion] = useState<{ id: string; punto: Punto }[]>([]); // hasta 2 {id, punto}
  const [distancia1TriangulacionInput, setDistancia1TriangulacionInput] = useState("");
  const [distancia2TriangulacionInput, setDistancia2TriangulacionInput] = useState("");
  const [candidatosTriangulacion, setCandidatosTriangulacion] = useState<Punto[]>([]); // 0-2 puntos MODELO (metros), resultado de interseccionCirculos

  // Modo "ambiente" — generador por dimensión conocida (pedido
  // explícito del usuario: "etiqueta + perímetro 12x8m" → un polígono
  // de ese tamaño exacto, en vez de trazarlo a mano). nombre/ancho/alto
  // se completan ANTES de hacer click (el click solo define el CENTRO
  // donde aparece), mismo criterio que el modo "equipo".
  const [nombreAmbienteNuevo, setNombreAmbienteNuevo] = useState("");
  const [anchoAmbienteInput, setAnchoAmbienteInput] = useState("");
  const [altoAmbienteInput, setAltoAmbienteInput] = useState("");

  // `entidad` es cualquiera de las entidades vinculables (Tablero, Equipo,
  // Circuito, FuenteEnergia, Transformador, Diferencial) según
  // `comp.entidadVinculada` — un discriminante ajeno al tipo real de TS, no
  // una unión discriminada propia. Se tipa como objeto genérico y se castea
  // adentro (mismo patrón que `coincide` en PanelDirectorio.tsx).
  function etiquetaEntidadEquipo(tipoEquipo: string, entidadBase: unknown): string {
    const entidad = entidadBase as Record<string, unknown>;
    const nombre = String(entidad.nombre ?? "");
    const comp = App.plano.obtenerComponente(tipoEquipo);
    if (comp?.entidadVinculada === "equipo") {
      const circuito = circuitos.find((c) => c.id === entidad.circuitoId);
      const tablero = circuito ? tableros.find((t) => t.id === circuito.tableroId) : null;
      const contexto = [circuito?.nombre, tablero?.nombre].filter(Boolean).join(" · ");
      return contexto ? `${nombre || "Equipo sin nombre"} (${contexto})` : nombre || "Equipo sin nombre";
    }
    if (comp?.entidadVinculada === "circuito") {
      const tablero = tableros.find((t) => t.id === entidad.tableroId);
      const etiqueta = entidad.etiqueta ? `${entidad.etiqueta} — ` : "";
      return tablero ? `${etiqueta}${nombre || "Circuito sin nombre"} (${tablero.nombre})` : `${etiqueta}${nombre || "Circuito sin nombre"}`;
    }
    if (comp?.entidadVinculada === "diferencial") {
      const cantidad = circuitos.filter((c) => c.diferencialId === entidad.id).length;
      return `${nombre || "Diferencial sin nombre"} (${entidad.sensibilidadMA ?? 30}mA · ${cantidad} circuito${cantidad === 1 ? "" : "s"})`;
    }
    return nombre || "(sin nombre)";
  }

  function mostrarAviso(texto: string) {
    setAviso(texto);
    setTimeout(() => setAviso(""), 5000);
  }

  function cambiarModo(nuevoModo: string) {
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

  function calcularCandidatosTriangulacion(e: FormEvent) {
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

  function alCrearPlanoSinImagen(e: FormEvent) {
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

  async function alSeleccionarArchivo(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo después
    if (!archivo) return;
    setCargando(true);
    try {
      await cargarImagenPlano(archivo);
      cambiarModo("mover");
    } catch (err) {
      mostrarAviso(err instanceof Error ? err.message : "No se pudo cargar la imagen.");
    } finally {
      setCargando(false);
    }
  }

  /**
   * Aplica el snap de ángulo (ver modules/geometria/index.ts) contra el
   * ÚLTIMO punto ya trazado de `trazoActual` — nada que snapear si es
   * el primer punto del trazo (no hay tramo anterior) o si el toggle
   * está apagado. Convierte a espacio MODELO para el cálculo (el
   * propio módulo de geometría trabaja en metros, nunca en píxeles) y
   * de vuelta a espacio IMAGEN para que agregarNodoPlano siga
   * recibiendo lo que siempre espera.
   *
   * Si el click YA cae cerca de un nodo existente (o, en modo
   * "conductor", de un marcador de equipo — `pegarAEquipo`), ese
   * pegado manda siempre y el ángulo no se toca: agregarNodoPlano ya
   * resuelve ESE caso solo (conectar paredes exactas, "pegar
   * conductor a equipo"), y correrlo con el snap de ángulo podría
   * alejarlo lo suficiente como para perder ese pegado.
   */
  function puntoImagenConSnapAngulo(puntoImagen: Punto, pegarAEquipo = false) {
    if (!snapAngulo || trazoActual.length === 0 || !planoCalibracion) return puntoImagen;
    const escala = planoCalibracion.escalaMetrosPorPixel;
    const puntoModelo = App.plano.imagenAModelo(puntoImagen, escala);
    if (App.plano.nodoCercano(puntoModelo, nodosPlano)) return puntoImagen;
    if (pegarAEquipo && App.plano.nodoCercano(puntoModelo, marcadoresEquipoPlano)) return puntoImagen;
    const nodoAnterior = nodosPlano.find((n) => n.id === trazoActual[trazoActual.length - 1]);
    if (!nodoAnterior) return puntoImagen;
    const puntoModeloSnapeado = App.plano.puntoConAnguloSnapeado(nodoAnterior.punto, puntoModelo);
    return App.plano.modeloAImagen(puntoModeloSnapeado, escala);
  }

  // Promover "Detectar ambientes automáticamente" (usuario, 2026-11-25,
  // señalado de pasada: "está poco promovido en la UI" — hasta ahora
  // era un botón siempre visible pero pasivo, sin ninguna señal de
  // cuándo realmente hay algo nuevo que detectar). Recorre TODAS las
  // caras cerradas de las paredes trazadas (mismo `detectarCaras` que
  // ya usa el botón al hacer click) y cuenta cuántas NO coinciden
  // todavía con ningún ambiente ya registrado (mismo criterio de
  // dedup por conjunto de nodos que usa detectarAmbientesPlano en el
  // hook) — puramente de LECTURA, no registra nada hasta que se hace
  // click. Con esto, el botón puede "iluminarse" solo cuando de verdad
  // hay algo para detectar, en vez de ser un botón mudo todo el tiempo.
  const ambientesSinDetectar = useMemo(() => {
    if (nodosPlano.length === 0) return 0;
    const caras = App.plano.detectarCaras(nodosPlano, segmentosPlano);
    const clave = (nodoIds: string[]) => [...nodoIds].sort().join(",");
    const existentes = new Set(habitacionesPlano.map((h) => clave(h.nodoIds)));
    return caras.filter((c) => !existentes.has(clave(c.nodoIds))).length;
  }, [nodosPlano, segmentosPlano, habitacionesPlano]);

  function alClickImagen(puntoImagen: Punto) {
    if (modo === "mover") {
      const escala = planoCalibracion?.escalaMetrosPorPixel;
      if (!escala) return;
      const puntoModelo = App.plano.imagenAModelo(puntoImagen, escala);
      const habitacion = App.plano.habitacionQueContiene(puntoModelo, habitacionesPlano, nodosPlano);
      setHabitacionResaltadaId((actual) => (habitacion && habitacion.id !== actual ? habitacion.id : null));
      return;
    }

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
      puntoImagen = puntoImagenConSnapAngulo(puntoImagen);
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
      puntoImagen = puntoImagenConSnapAngulo(puntoImagen, true);
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
  function alTrazarRectangulo(puntoImagenA: Punto, puntoImagenB: Punto) {
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
  function reconocerParedesEnArea(puntoImagenA: Punto, puntoImagenB: Punto) {
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
  function manejarPuntoTriangulacion(puntoModelo: Punto, referenciaDirecta: { id: string; punto: Punto } | MarcadorEquipoPlano | null = null) {
    if (!planoCalibracion) return;
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

  function alClickMarcador(marcador: MarcadorEquipoPlano) {
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
  function aceptarParedCandidata(candidato: LineaCandidata) {
    const nodoA = agregarNodoPlano({ x: candidato.x1, y: candidato.y1 });
    const nodoB = agregarNodoPlano({ x: candidato.x2, y: candidato.y2 });
    if (nodoA && nodoB) agregarSegmentoPlano(nodoA.id, nodoB.id, "pared");
    setParedesCandidatas(paredesCandidatas.filter((c) => c !== candidato));
  }

  async function confirmarPerspectiva(e: FormEvent) {
    e.preventDefault();
    setCorrigiendoPerspectiva(true);
    try {
      const resultado = await corregirPerspectivaPlano(puntosPerspectiva, parseFloat(anchoRealInput), parseFloat(altoRealInput));
      if (!resultado.ok) {
        mostrarAviso(resultado.motivo ?? "No se pudo corregir la perspectiva.");
        return;
      }
      mostrarAviso("Perspectiva corregida — el plano ya quedó calibrado, podés trazar directo.");
      cambiarModo("pared");
    } finally {
      setCorrigiendoPerspectiva(false);
    }
  }

  function confirmarCalibracionPerimetro(e: FormEvent) {
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

  function confirmarCalibracion(e: FormEvent) {
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

  function entrarPantallaCompletaPlano() {
    setPantallaCompletaPlano(true);
    setMenuPlanoExpandido(true);
    contenedorPlanoRef.current?.requestFullscreen?.().catch(() => {});
    screen.orientation?.lock?.("landscape").catch(() => {});
  }

  function salirPantallaCompletaPlano() {
    setPantallaCompletaPlano(false);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    screen.orientation?.unlock?.();
  }

  // Bug real reportado por el usuario (celular→desktop, 2026-11-26/27:
  // "estoy en modo pantalla completa editando tranquilo... al tocar
  // deshacer me saca de pantalla completa"): este efecto ANTES
  // sincronizaba el modo CSS (`pantallaCompletaPlano`, la fuente de
  // verdad de TODO el layout — lienzo grande, menú colapsado) cada vez
  // que `document.fullscreenElement` se volvía null, pensado
  // originalmente para el botón atrás de Android/gestos del sistema.
  // En desktop, una acción SIN NINGUNA relación con pantalla completa
  // (Deshacer) hacía que el navegador del usuario saliera de la
  // Fullscreen API real por su cuenta (motivo del navegador/SO, no de
  // esta app — no reproducido en Chromium headless, pero sí real en su
  // navegador) — y este efecto, confiando ciegamente en ESE evento,
  // colapsaba TODO el modo CSS con él, perdiendo el lienzo grande y el
  // menú colapsado en medio de una edición sin que el usuario lo
  // pidiera. Quitado a propósito: el botón "⤡ Salir" (SIEMPRE visible
  // dentro del lienzo, en cualquiera de los 2 modos) sigue siendo la
  // ÚNICA forma de salir del modo CSS — nunca se infiere de un evento
  // externo que puede dispararse por motivos ajenos a la intención real
  // del usuario. Si el sistema sale de la Fullscreen API real por su
  // cuenta (ESC, gesto), el modo CSS se queda como está: en el peor
  // caso vuelve el chrome del navegador alrededor del lienzo grande,
  // nunca un colapso sorpresivo de todo el layout.

  // Bug real encontrado probando pantalla completa + "Restablecer"
  // (usuario, 2026-11-28): al entrar y salir de pantalla completa, el
  // lienzo quedaba "fantasma" tapando TODA la pantalla (hasta bloqueando
  // clicks en Diagrama unifilar/otras pestañas) — nunca un problema de
  // z-index, sino de posicionamiento: este componente vive dentro de
  // SubTabs.tsx, que desliza sus 3 sub-pestañas con un `transform:
  // translateX(...)` en un div ancestro. Por especificación CSS, CUALQUIER
  // ancestro con `transform` pasa a ser el "contenedor de posicionamiento"
  // de un descendiente `position:fixed` (el mismo motivo ya documentado en
  // App.tsx para el `transform:none` de impresión con TabsViewPager) — el
  // `inset:0` de abajo entonces NO se resuelve contra el viewport real
  // sino contra esa tira deslizante, dejando el lienzo mal posicionado y
  // reteniendo los clicks. `createPortal` saca este árbol fuera de esa
  // jerarquía SOLO mientras está en pantalla completa, renderizándolo
  // directo en `document.body` — en modo normal sigue exactamente en su
  // lugar de siempre, sin ancestros con transform de por medio.
  const vista = (
    <div
      ref={contenedorPlanoRef}
      className="plano-grid"
      style={
        pantallaCompletaPlano
          ? { position: "fixed", inset: 0, zIndex: 2000, background: colores.bg, padding: 10, overflow: "auto", display: "grid", gridTemplateColumns: "1fr 280px", gap: 14, alignItems: "start" }
          : { display: "grid", gridTemplateColumns: "1fr 280px", gap: 14, alignItems: "start" }
      }
    >
      {/* minWidth:0 — bug real encontrado probando pantalla completa
          (usuario, 2026-11-26): esta columna "1fr" de la grilla, sin
          esto, toma por defecto minmax(auto, 1fr) — el SVG del lienzo
          adentro trae un ancho en PÍXELES (no %), que cuenta como su
          "ancho preferido" para ese "auto". Cada vez que PlanoCanvas
          medía su contenedor y achicaba/agrandaba el <svg> a ese
          tamaño, la columna se re-media UN PELO más grande (así nunca
          recorta nada), lo que hacía crecer el <svg> de nuevo — un
          loop infinito que corría cada frame sin romper nada visible
          salvo que TODO lo de esta columna derivaba 4px por cuadro
          hacia la derecha para siempre. minWidth:0 fuerza el track a
          NO crecer por el contenido — el ancho real lo sigue dando la
          grilla, nunca el <svg>. */}
      <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: 14, minWidth: 0 }}>
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

        {planoImagen && (planoImagen.paginasTotal ?? 0) > 1 && (
          <div style={{ fontSize: 11, color: colores.textDim, marginBottom: 10 }}>
            Este PDF tiene {planoImagen.paginasTotal} páginas — por ahora se usa solo la primera.
          </div>
        )}

        {planoImagen && (
          <>
            {/* En pantalla completa, el selector de modos + "Mostrar:"
                (lo más ancho de toda la pantalla, 17 botones) se
                esconde detrás de este botón — colapsado por defecto NO
                tendría sentido (nadie podría elegir un modo para
                empezar), así que arranca expandido y el instalador lo
                retrae cuando quiere ver el lienzo completo. Fuera de
                pantalla completa este botón ni existe — nada cambia en
                el uso normal de escritorio. */}
            {pantallaCompletaPlano && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
                <button
                  type="button"
                  onClick={() => setMenuPlanoExpandido((v) => !v)}
                  style={{ padding: "6px 12px", borderRadius: 3, border: `1px solid ${colores.border}`, background: "transparent", color: colores.copper, fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}
                >
                  {menuPlanoExpandido ? "▾ Ocultar herramientas" : "☰ Herramientas"}
                </button>
              </div>
            )}
            <div style={pantallaCompletaPlano && !menuPlanoExpandido ? { display: "none" } : undefined}>
            {pantallaCompletaPlano ? (
              // Acordeón por categoría (usuario, 2026-11-26: "despliega
              // un menú que contenga apartados... ambiente lo tocas y
              // muestra todos los botones relacionado con esa función")
              // — SOLO en pantalla completa; la fila plana de abajo
              // (escritorio) sigue exactamente igual, sin tocar.
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {CATEGORIAS_MODOS.map((cat) => (
                    <BotonPill
                      key={cat}
                      activo={categoriaMenuAbierta === cat}
                      onClick={() => setCategoriaMenuAbierta((actual) => (actual === cat ? null : cat))}
                      flex="0 0 auto"
                    >
                      {cat}
                    </BotonPill>
                  ))}
                </div>
                {categoriaMenuAbierta && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${colores.border}` }}>
                    {MODOS.filter((m) => m.grupo === categoriaMenuAbierta).map((m) => (
                      <BotonPill key={m.valor} activo={modo === m.valor} onClick={() => cambiarModo(m.valor)} flex="0 0 auto">
                        {m.label}
                      </BotonPill>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // Una sola fila que se acomoda sola (igual que la versión
              // original, sin grupo) — una primera versión forzaba 5
              // filas fijas (una por grupo), lo que empujaba el lienzo
              // del plano hacia abajo lo suficiente como para que,
              // en un plano alto, quedara parcialmente fuera de la
              // vista (regresión real encontrada con Playwright, no
              // solo un detalle de la prueba: cualquier usuario con
              // una ventana más baja hubiera tenido que scrollear de
              // más). Las etiquetas de grupo son solo un separador
              // chico inline, nunca fuerzan un salto de línea propio.
              <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
                {MODOS.map((m, i) => (
                  <Fragment key={m.valor}>
                    {(i === 0 || MODOS[i - 1].grupo !== m.grupo) && (
                      <span
                        style={{
                          fontSize: 9,
                          color: colores.textDim,
                          textTransform: "uppercase",
                          letterSpacing: "0.03em",
                          paddingLeft: i === 0 ? 0 : 8,
                          borderLeft: i === 0 ? "none" : `1px solid ${colores.border}`,
                        }}
                      >
                        {m.grupo}
                      </span>
                    )}
                    <BotonPill activo={modo === m.valor} onClick={() => cambiarModo(m.valor)} flex="0 0 auto">
                      {m.label}
                    </BotonPill>
                  </Fragment>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, fontSize: 11, color: colores.textDim }}>
              <span>Mostrar:</span>
              {(
                [
                  { clave: "fondo", label: "Imagen de fondo" },
                  { clave: "pared", label: "Paredes" },
                  { clave: "conductor", label: "Conductores" },
                  { clave: "equipos", label: "Equipos" },
                ] as const
              ).map((c) => (
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
              {(modo === "pared" || modo === "conductor") && planoCalibracion && (
                <>
                  {" "}·{" "}
                  <label style={{ cursor: "pointer" }}>
                    <input type="checkbox" checked={snapAngulo} onChange={(e) => setSnapAngulo(e.target.checked)} style={{ marginRight: 4 }} />
                    Snap de ángulo (pega cada tramo a 0°/15°/30°/45°... si ya está cerca)
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
          habitacionResaltadaId={habitacionResaltadaId}
          etiquetaCircuitoPorMarcadorId={etiquetaCircuitoPorMarcadorId}
          escalaMetrosPorPixel={planoCalibracion?.escalaMetrosPorPixel ?? null}
          puntosGuiaPendientes={
            modo === "perspectiva"
              ? puntosPerspectiva
              : modo === "calibrar-perimetro"
                ? puntosContornoCalibracion
                : modo === "espesor"
                  ? puntosEspesor
                  : modo === "triangular" && planoCalibracion
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
          ocuparAltoDisponible={pantallaCompletaPlano}
          pantallaCompleta={pantallaCompletaPlano}
          onTogglePantallaCompleta={pantallaCompletaPlano ? salirPantallaCompletaPlano : entrarPantallaCompletaPlano}
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
            <div style={{ fontSize: 11, color: colores.textDim, letterSpacing: "0.06em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
              Ambientes ({habitacionesPlano.length})
              {ambientesSinDetectar > 0 && (
                <span style={{ color: colores.warn, textTransform: "none", letterSpacing: "normal", fontWeight: 600 }}>
                  · 💡 {ambientesSinDetectar} sin registrar
                </span>
              )}
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
                title={
                  ambientesSinDetectar > 0
                    ? `Hay ${ambientesSinDetectar} ambiente(s) cerrado(s) por las paredes trazadas que todavía no están registrados — click para agregarlos de una.`
                    : "Analiza TODAS las paredes trazadas y registra cada ambiente cerrado que encuentre — incluidos los que una pared interior separa de otro, sin tener que volver a trazarlos a mano."
                }
                style={
                  ambientesSinDetectar > 0
                    ? { padding: "5px 10px", borderRadius: 3, border: `1px solid ${colores.copper}`, background: colores.copper, color: colores.textSobreAcento, fontWeight: 700, fontSize: 11, cursor: "pointer" }
                    : { padding: "5px 10px", borderRadius: 3, border: `1px solid ${colores.border}`, background: "transparent", color: colores.textDim, fontWeight: 600, fontSize: 11, cursor: "pointer" }
                }
              >
                Detectar ambientes automáticamente
              </button>
            )}
          </div>
          {habitacionesPlano.length === 0 ? (
            <div style={{ fontSize: 12, color: colores.textDim, lineHeight: 1.4 }}>
              {ambientesSinDetectar > 0
                ? `Ya hay ${ambientesSinDetectar} ambiente${ambientesSinDetectar === 1 ? "" : "s"} cerrado${ambientesSinDetectar === 1 ? "" : "s"} formado${ambientesSinDetectar === 1 ? "" : "s"} por las paredes trazadas — usá "Detectar ${ambientesSinDetectar} ambiente${ambientesSinDetectar === 1 ? "" : "s"} nuevo${ambientesSinDetectar === 1 ? "" : "s"}" arriba para agregarlo${ambientesSinDetectar === 1 ? "" : "s"} de una, sin re-trazar nada.`
                : 'Cerrá un trazo de pared (volvé al punto de inicio) para que aparezca acá, con su área y perímetro ya calculados — o trazá varios cuartos compartiendo paredes y usá "Detectar ambientes automáticamente".'}
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
                  {/* Tipo de ambiente — usuario, 2026-11-25/26: "el ambiente
                      donde se localiza" un tomacorriente. Determina dónde
                      NEC 210.8(A)/(B) exige GFCI (ver advertenciasGFCI,
                      modules/plano/proteccionGFCI.ts) — informativo incluso
                      bajo otra normativa, por si hace falta para REBT más
                      adelante (ITC-BT-27, volúmenes de baño). */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 10.5, color: colores.textDim }}>Tipo de ambiente:</span>
                    <select
                      value={h.tipoAmbiente ?? "otro"}
                      onChange={(e) => editarTipoAmbienteHabitacionPlano(h.id, e.target.value as TipoAmbiente)}
                      style={{ ...inputStyle(), padding: "3px 6px", fontSize: 10.5 }}
                    >
                      {App.plano.OPCIONES_TIPO_AMBIENTE.map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.label}
                        </option>
                      ))}
                    </select>
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
              {/* Origen alternativo (usuario, 2026-11-26, "...y sea el
                  punto de arranque real"): por default arranca del
                  tablero del circuito, igual que siempre — elegir una
                  caja de empalme ya colocada cambia SOLO desde dónde
                  busca el camino más corto, nunca a qué circuito
                  pertenece la ruta ni su vínculo eléctrico. */}
              <select
                value={origenRutaAutoSeleccionado}
                onChange={(e) => setOrigenRutaAutoSeleccionado(e.target.value)}
                title="Por default arranca del tablero del circuito — elegí una caja de empalme ya colocada para arrancar desde ahí en vez de volver siempre al tablero."
                style={{ padding: "5px 8px", borderRadius: 3, border: `1px solid ${colores.border}`, background: colores.bg, color: colores.textMain, fontSize: 11.5, maxWidth: 190 }}
              >
                <option value="">Desde: tablero (automático)</option>
                {marcadoresEquipoPlano
                  .filter((m) => m.tipo === "caja_empalme")
                  .map((m, i) => (
                    <option key={m.id} value={m.id}>
                      Desde: {m.nombre || `Caja de empalme ${i + 1}`}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                disabled={!circuitoRutaAutoSeleccionado}
                onClick={() => {
                  const resultado = generarRutasAutomaticasCircuito(circuitoRutaAutoSeleccionado, origenRutaAutoSeleccionado || null);
                  if (resultado?.sinTablero) {
                    mostrarAviso("Ese circuito no tiene un tablero vinculado a un marcador en el plano todavía — colocalo primero con \"Colocar equipo\".");
                    return;
                  }
                  if (resultado?.sinOrigen) {
                    mostrarAviso("La caja de empalme elegida como origen ya no existe — elegí otra o volvé a \"tablero (automático)\".");
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
                // calcularLongitudEsperadaRuta extiende calcularCrucesPared
                // (mismos campos: cruces/extraTotalM/longitudTotalM/
                // paredesSinEspesor/paredesAnguloIndeterminado) + la
                // bajada/subida real hasta el equipo del extremo de la
                // ruta, si tiene altura de instalación cargada (usuario,
                // 2026-11-25: "hay que tomar en cuenta la altura donde se
                // instala un interruptor [o] tomacorriente" — ver
                // modules/plano/alturaInstalacion.ts).
                const cruces = App.plano.calcularLongitudEsperadaRuta(r, nodosPlano, segmentosPared, marcadoresEquipoPlano, equipos, habitacionesPlano, alturaTechoPlanoM);
                const extraAltura = cruces.alturaInstalacion;
                const hayExtra = cruces.cruces.length > 0 || extraAltura.extraM > 0;
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
                        <> · +{cruces.extraTotalM.toFixed(2)} m por {cruces.cruces.length} cruce{cruces.cruces.length !== 1 ? "s" : ""} de pared</>
                      )}
                      {extraAltura.extraM > 0 && (
                        <>
                          {" "}
                          · +{extraAltura.extraM.toFixed(2)} m {extraAltura.referencia === "piso" ? "subiendo desde el piso" : "bajando desde el techo"} al equipo
                        </>
                      )}
                      {hayExtra && (
                        <>
                          {" "}
                          · <strong style={{ color: colores.textMain }}>total {cruces.longitudTotalConAlturaM.toFixed(2)} m</strong>
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
                    {extraAltura.motivo && (
                      <div style={{ fontSize: 10.5, color: colores.warn, marginTop: 2 }}>⚠ {extraAltura.motivo}</div>
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
                              vincularRutaConductorPlano(r.id, id, tipo as EntidadVinculadaRuta);
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
                                Distancia actual: {Number(("distancia" in entidad ? entidad.distancia : entidad.longitudAlimentador) || 0).toFixed(2)} m
                              </span>
                              <button
                                type="button"
                                onClick={() => aplicarLongitudRutaPlano(r.id)}
                                style={{ background: "none", border: "none", color: colores.copper, fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 11 }}
                              >
                                Usar esta longitud ({cruces.longitudTotalConAlturaM.toFixed(2)} m)
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
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: (comp && COLOR_POR_CATEGORIA[comp.categoria as keyof typeof COLOR_POR_CATEGORIA]) ?? colores.border, flexShrink: 0 }} />
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
                    {(() => {
                      const advertenciaGFCI = advertenciasGFCI.find((a) => a.marcadorId === m.id);
                      return (
                        advertenciaGFCI && (
                          <div style={{ fontSize: 10.5, color: colores.warn, marginTop: 4, display: "flex", gap: 4, alignItems: "flex-start" }}>
                            <span>⚡</span>
                            <span>Requiere GFCI ({advertenciaGFCI.motivo}) — marcalo en "Protegido por GFCI" al editar el equipo.</span>
                          </div>
                        )
                      );
                    })()}
                    {(() => {
                      const advertenciaAFCI = advertenciasAFCI.find((a) => a.equipoId === m.entidadId);
                      return (
                        advertenciaAFCI && (
                          <div style={{ fontSize: 10.5, color: colores.warn, marginTop: 4, display: "flex", gap: 4, alignItems: "flex-start" }}>
                            <span>⚡</span>
                            <span>
                              Su circuito requiere AFCI ({advertenciaAFCI.motivo}) — marcalo en "Protegido por AFCI" al
                              editar el circuito.
                            </span>
                          </div>
                        )
                      );
                    })()}
                    {/* Radio del Volumen 1 (ITC-BT-27 §2.1.2) — solo para
                        "Fuente de agua". Default 0,6m (ducha con rociador
                        fijo, el único número exacto de la norma para el
                        caso típico); 1,2m para difusor móvil, o el
                        medio-ancho real para una bañera/ducha más grande.
                        Ver modules/plano/volumenesBano.ts. */}
                    {m.tipo === "fuente_agua" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                        <span style={{ fontSize: 10.5, color: colores.textDim }} title="Huella de la bañera/ducha — ITC-BT-27 §2.1.2. Default 0,6m.">
                          Radio Volumen 1 (m):
                        </span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={m.radioVolumen1M ?? ""}
                          onChange={(e) => editarMarcadorEquipoPlano(m.id, { radioVolumen1M: e.target.value === "" ? null : e.target.value })}
                          placeholder="0.6"
                          style={{ ...inputStyle(), width: 60, padding: "3px 6px", fontSize: 10.5 }}
                        />
                      </div>
                    )}
                    {/* "Que la caja de empalme sepa qué circuito(s) pasan
                        por ella" (usuario, 2026-11-26) — puramente
                        derivado de las rutas de conductor YA VINCULADAS
                        cuyo camino pasa cerca de esta caja, nunca un dato
                        propio del marcador (ver PlanoMediator.
                        entidadesPorCajaEmpalme). */}
                    {m.tipo === "caja_empalme" &&
                      (() => {
                        const entidades = entidadesPorCajaEmpalme[m.id] ?? [];
                        return (
                          <div style={{ fontSize: 10.5, color: colores.textDim, marginTop: 4 }}>
                            {entidades.length > 0
                              ? `Pasan por acá: ${entidades.map((e) => e.nombre || "(sin nombre)").join(", ")}`
                              : "Todavía ningún circuito/tablero vinculado pasa por acá (ver \"Rutas de conductor\" → Vincular a)."}
                          </div>
                        );
                      })()}
                    {(() => {
                      const a = advertenciasVolumenBano.find((x) => x.marcadorId === m.id);
                      return (
                        a && (
                          <div style={{ fontSize: 10.5, color: a.nivel === "error" ? colores.error : colores.warn, marginTop: 4, display: "flex", gap: 4, alignItems: "flex-start" }}>
                            <span>🛁</span>
                            <span>
                              {a.nivel === "error"
                                ? `Prohibido por ITC-BT-27 (${a.motivo}) — a ${a.distanciaM.toFixed(2)}m de una fuente de agua.`
                                : `${a.motivo} — sin diferencial ≤30mA asignado a su circuito.`}
                            </span>
                          </div>
                        )
                      );
                    })()}
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

  return pantallaCompletaPlano ? createPortal(vista, document.body) : vista;
}

/** Segmento más cercano a un punto (modelo, metros) — distancia punto-a-segmento mínima. */
function segmentoMasCercano(puntoModelo: Punto, nodos: NodoPlano[], segmentos: SegmentoPlano[]): SegmentoPlano | null {
  let mejor: SegmentoPlano | null = null;
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

function distanciaPuntoSegmento(p: Punto, a: Punto, b: Punto): number {
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
