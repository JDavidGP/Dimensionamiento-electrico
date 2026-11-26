import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { colores } from "../styles/colores";
import { ApplicationMediator as App } from "../core/ApplicationMediator.js";
import { SimboloDiagrama } from "./simbolosDiagrama.jsx";

// Mismo mapa categoría->color que ya usa DiagramaUnifilar.jsx — un
// equipo marcado en el plano se ve del mismo color que su nodo en el
// diagrama unifilar, coherencia visual entre las dos vistas de la
// misma entidad (ver nota de arquitectura en modules/plano/index.js).
const COLOR_POR_CATEGORIA = {
  fuente: colores.ok,
  medicion_proteccion: colores.warn,
  distribucion: colores.copper,
  control: colores.copperDim,
  carga: colores.textDim,
};

function colorDeEquipo(tipo) {
  const comp = App.plano.obtenerComponente(tipo);
  return COLOR_POR_CATEGORIA[comp?.categoria] ?? colores.border;
}

// Modos que arrastran un rectángulo de esquina a esquina — mismo gesto
// visual (vista previa punteada + onTrazarRectangulo al soltar), el
// PADRE decide qué hacer con las 2 esquinas según cuál de los dos
// modos esté activo (crear un ambiente, o acotar "Reconocer paredes"
// a esa zona — usuario, 2026-11-24).
function esModoArrastreRectangulo(modo) {
  return modo === "rectangulo" || modo === "area_paredes";
}

// Escalar el símbolo de equipo al tamaño real del plano (usuario,
// 2026-11-24: "se escale al tamaño del plano para una mejor
// presentación") — antes era un ícono de tamaño fijo en pantalla
// (22px, SIEMPRE igual sin importar el zoom), lo que lo hacía ver
// "pegado" en vez de parte del dibujo cuando las paredes/ambientes sí
// escalaban con el zoom. 0,3 m es un tamaño de PRESENTACIÓN (no la
// medida eléctrica real de ningún equipo puntual — una caja de
// empalme, un interruptor y un tablero no miden lo mismo) — se acota
// entre 14 y 48px en pantalla para que nunca sea invisible al alejar
// ni gigante al acercar demasiado. Sin calibrar, no hay "tamaño real"
// que escalar — se mantiene el tamaño fijo de siempre.
const TAMANO_REAL_EQUIPO_M = 0.3;
const TAMANO_MIN_PANTALLA_PX = 14;
const TAMANO_MAX_PANTALLA_PX = 48;
function tamanoMarcadorPx(escalaMetrosPorPixel, zoom) {
  if (!escalaMetrosPorPixel) return 22 / zoom;
  const enPantalla = (TAMANO_REAL_EQUIPO_M / escalaMetrosPorPixel) * zoom;
  const acotado = Math.max(TAMANO_MIN_PANTALLA_PX, Math.min(TAMANO_MAX_PANTALLA_PX, enPantalla));
  return acotado / zoom;
}

// Motor de renderizado — ver PLANO_INTELIGENTE_DISENO.md §2. Es el
// ÚNICO componente que sabe de `transformVista` (zoom/pan, efímero) y
// de SVG/DOM; NO sabe qué significa un click (calibrar/trazar pared/
// borrar) — eso lo decide quien lo use, vía `onClickImagen`, que
// recibe el punto YA convertido a espacio IMAGEN (píxeles del archivo
// cargado, antes de aplicar la escala de calibración). Tampoco calcula
// ninguna distancia/área — eso es modules/geometria/ vía PlanoMediator,
// llamado por el padre, nunca acá.
//
// `nodos`/`segmentos` llegan en METROS (espacio modelo) — para
// dibujarlos sobre la imagen de fondo (en píxeles) se convierten de
// vuelta con `modeloAImagen` usando la escala de calibración. Esta es
// la única razón por la que este componente necesita la escala: para
// posicionar el fondo correctamente, nunca para calcular nada.
const PlanoCanvas = forwardRef(function PlanoCanvas(
  {
    imagen,
    mostrarImagenFondo = true,
    nodos = [],
    segmentos = [],
    marcadoresEquipo = [],
    habitaciones = [],
    escalaMetrosPorPixel,
    puntosGuiaPendientes = [],
    nodoIdsTrazoActual = [],
    modo,
    asistenciaBordes = false,
    paredesCandidatas = [],
    puertasCandidatas = [],
    candidatosTriangulacion = [],
    conexionesDiagrama = [],
    onClickImagen,
    onClickMarcador,
    onArrastrarHabitacion,
    onArrastrarMarcador,
    onIniciarArrastre,
    onClickParedCandidata,
    onTrazarRectangulo,
    ocuparAltoDisponible = false,
  },
  ref
) {
  const contenedorRef = useRef(null);
  const svgRef = useRef(null);
  const [tamanoCanvas, setTamanoCanvas] = useState({ ancho: 0, alto: 0 });
  const [transformVista, setTransformVista] = useState(() => App.plano.transformVistaInicial());
  const arrastreRef = useRef(null); // { xInicial, yInicial, transformInicial } — solo en modo "mover"
  // Arrastre de un ambiente entero — modo "mover-ambiente", separado
  // del de arriba (uno mueve la VISTA, este mueve DATOS del proyecto).
  // { habitacionId, x, y, seMovio }.
  const arrastreAmbienteRef = useRef(null);
  // Arrastre de un equipo ya colocado — modo "mover-equipo" (usuario,
  // 2026-11-24: "genera un grupo... que puedes mover a placer").
  // { marcadorId, x, y, seMovio } — mismo contrato que arrastreAmbienteRef,
  // pero arranca en el onPointerDown del propio marcador (necesita
  // acertarle al ícono, no "cualquier punto del ambiente" como una
  // habitación) en vez del contenedor entero.
  const arrastreMarcadorRef = useRef(null);
  // Pellizco de 2 dedos (zoom + pan táctil) — usuario, 2026-11-26,
  // "continuemos con el mobile táctil". Antes de esto, el único zoom
  // era la rueda del mouse (alWheel); en un teléfono no hay rueda, y
  // "pan-y" en touchAction bloqueaba incluso el pinch-zoom NATIVO del
  // navegador sobre el lienzo, así que no había NINGUNA forma táctil
  // de acercar/alejar salvo los botones +/-. punterosRef rastrea cada
  // dedo por su pointerId (nunca por posición), para que un 2do dedo
  // que cae por accidente durante un arrastre de 1 dedo no lo
  // corrompa (antes, alPointerMove mezclaba clientX/Y de cualquier
  // puntero sin distinguirlos). pinchRef guarda la distancia/punto
  // medio del pellizco activo, para medir el DELTA cuadro a cuadro
  // (nunca el total desde el inicio, que se desalinearía cada vez que
  // se recalibra el punto medio).
  const punterosRef = useRef(new Map());
  const pinchRef = useRef(null);
  // Arrastre de un rectángulo nuevo — modo "rectangulo" (usuario,
  // 2026-11-23: "click en una esquina... estiramos hacia la otra
  // esquina"). `inicio`/`actual` en espacio IMAGEN (mismo contrato que
  // onClickImagen) — SOLO para dibujar la vista previa en vivo acá; el
  // rectángulo real lo arma el padre (onTrazarRectangulo) recién al
  // soltar, nunca mientras se arrastra.
  const [rectanguloArrastre, setRectanguloArrastre] = useState(null);
  // Canvas oculto con los píxeles de la imagen cargada — solo para que
  // alClick pueda leer un parche chico y "pegarse" al borde más
  // cercano (ver modules/plano/deteccionBordes.js). Se arma UNA vez
  // por imagen, no en cada click.
  const contextoPixelesRef = useRef(null);

  // Único método expuesto al padre (PlanoInteligente.jsx): "Sugerir
  // paredes" (usuario, 2026-11-20) necesita leer TODOS los píxeles de
  // la imagen (no un parche chico como ajustarABorde) — se expone así,
  // en vez de duplicar el acceso al canvas oculto afuera, porque este
  // sigue siendo el ÚNICO componente que toca el DOM/canvas (ver nota
  // de cabecera del archivo).
  useImperativeHandle(ref, () => ({
    // `region` opcional (usuario, 2026-11-24: "seleccione una área
    // determinada arrastrando... que se quiere reconocer" — acotar la
    // detección a una zona, en vez de siempre la imagen completa, da
    // menos ruido/falsos positivos en un plano grande) — {x, y, ancho,
    // alto} en espacio IMAGEN, ya recortado/clampeado por el padre. Se
    // recorta el ImageData ahí mismo (más simple que enseñarle región
    // al algoritmo de deteccionLineas.ts) y se devuelven las
    // coordenadas YA desplazadas de vuelta a espacio imagen completo,
    // para que el resto del código (aceptarParedCandidata, etc.) no
    // necesite saber que hubo un recorte.
    detectarParedesCandidatas(region) {
      const ctx = contextoPixelesRef.current;
      if (!ctx) return { paredes: [], puertas: [] };
      const origenX = region?.x ?? 0;
      const origenY = region?.y ?? 0;
      const ancho = region?.ancho ?? ctx.canvas.width;
      const alto = region?.alto ?? ctx.canvas.height;
      if (ancho <= 0 || alto <= 0) return { paredes: [], puertas: [] };
      const datos = ctx.getImageData(origenX, origenY, ancho, alto).data;
      const grises = new Float32Array(ancho * alto);
      for (let i = 0; i < ancho * alto; i++) {
        grises[i] = 0.299 * datos[i * 4] + 0.587 * datos[i * 4 + 1] + 0.114 * datos[i * 4 + 2];
      }
      const resultado = App.plano.detectarParedesCandidatas(grises, ancho, alto, { escalaMetrosPorPixel });
      if (!origenX && !origenY) return resultado;
      const desplazar = (l) => ({ ...l, x1: l.x1 + origenX, y1: l.y1 + origenY, x2: l.x2 + origenX, y2: l.y2 + origenY });
      return { paredes: resultado.paredes.map(desplazar), puertas: resultado.puertas.map(desplazar) };
    },
  }));

  // Mide el contenedor al montar y en cada resize/orientation-change —
  // así "ajustar a ventana" siempre usa el tamaño REAL del dispositivo
  // actual, nunca uno guardado de otro dispositivo. SOLO en pantalla
  // completa (usuario, 2026-11-26, "mobile táctil") se agrega un
  // ResizeObserver sobre el propio contenedor, porque ahí el tamaño
  // cambia (position:fixed, ver PlanoInteligente) sin disparar un
  // resize de ventana. Bug real encontrado probándolo: activar el
  // ResizeObserver SIEMPRE (no solo en pantalla completa) refitea la
  // vista (ajustarAVentana, más abajo) cada vez que CUALQUIER cosa de
  // la página — ni siquiera el propio lienzo — hace que este
  // contenedor cambie 1px (ej. la lista de "Ambientes" creciendo
  // empuja el layout) — eso corría la vista a mitad de un arrastre de
  // mouse, haciendo que un "Mover ambiente" cayera 1px off. Fuera de
  // pantalla completa, "resize" de window (solo pasa si la VENTANA
  // cambia, nunca por un vecino de layout) es la única fuente —
  // exactamente el comportamiento de siempre, sin tocar nada.
  useEffect(() => {
    if (!contenedorRef.current) return;
    function medir() {
      if (!contenedorRef.current) return;
      const rect = contenedorRef.current.getBoundingClientRect();
      // Bail-out con epsilon — un ancho/alto en "calc(100vh - ...)"
      // puede devolver un valor con un pelo de diferencia entre dos
      // frames consecutivos por redondeo de subpíxel, y como el
      // objeto nuevo nunca es === al anterior, React re-renderiza en
      // CADA frame sin ningún cambio real. Devolver la MISMA
      // referencia cuando no cambió nada (más de 0.5px) deja que
      // React descarte el update sin repintar.
      setTamanoCanvas((anterior) => {
        if (Math.abs(anterior.ancho - rect.width) < 0.5 && Math.abs(anterior.alto - rect.height) < 0.5) return anterior;
        return { ancho: rect.width, alto: rect.height };
      });
    }
    medir();
    if (!ocuparAltoDisponible) {
      window.addEventListener("resize", medir);
      return () => window.removeEventListener("resize", medir);
    }
    const observador = new ResizeObserver(medir);
    observador.observe(contenedorRef.current);
    return () => observador.disconnect();
  }, [ocuparAltoDisponible]);

  // Al cargar una imagen nueva (o cambiar el tamaño del canvas), ajustar
  // la vista para que entre completa — ver ajustarAVentana en
  // modules/plano/coordenadas.js. Se recalcula siempre desde el tamaño
  // ACTUAL del canvas, nunca se restaura un zoom/pan guardado.
  useEffect(() => {
    if (!imagen || !tamanoCanvas.ancho || !tamanoCanvas.alto) return;
    setTransformVista(App.plano.ajustarAVentana(imagen.anchoPx, imagen.altoPx, tamanoCanvas.ancho, tamanoCanvas.alto));
  }, [imagen?.dataUrl, tamanoCanvas.ancho, tamanoCanvas.alto]);

  // Decodifica la imagen en un <canvas> oculto para poder leer sus
  // píxeles — ver alClick/ajustarABorde. Se rehace solo cuando cambia
  // la imagen, nunca en cada click/frame.
  useEffect(() => {
    contextoPixelesRef.current = null;
    if (!imagen) return;
    let cancelado = false;
    const img = new Image();
    img.onload = () => {
      if (cancelado) return;
      const lienzo = document.createElement("canvas");
      lienzo.width = imagen.anchoPx;
      lienzo.height = imagen.altoPx;
      const ctx = lienzo.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      contextoPixelesRef.current = ctx;
    };
    img.src = imagen.dataUrl;
    return () => {
      cancelado = true;
    };
  }, [imagen?.dataUrl]);

  /**
   * Ajusta un punto en espacio IMAGEN al borde más fuerte dentro de un
   * radio chico — si no hay ninguno claro, devuelve el punto tal cual.
   * Es solo una AYUDA al trazado manual, nunca detección automática de
   * paredes (ver la nota larga en modules/plano/deteccionBordes.js).
   */
  function ajustarABorde(puntoImagen) {
    const ctx = contextoPixelesRef.current;
    if (!ctx) return puntoImagen;
    const radio = App.plano.RADIO_BUSQUEDA_BORDE_PX;
    const cx = Math.round(puntoImagen.x);
    const cy = Math.round(puntoImagen.y);
    const margen = radio + 2;
    const x0 = Math.max(0, cx - margen);
    const y0 = Math.max(0, cy - margen);
    const ancho = Math.min(ctx.canvas.width - x0, margen * 2 + 1);
    const alto = Math.min(ctx.canvas.height - y0, margen * 2 + 1);
    if (ancho < 3 || alto < 3) return puntoImagen;

    const datos = ctx.getImageData(x0, y0, ancho, alto).data;
    const grises = new Float32Array(ancho * alto);
    for (let i = 0; i < ancho * alto; i++) {
      grises[i] = 0.299 * datos[i * 4] + 0.587 * datos[i * 4 + 1] + 0.114 * datos[i * 4 + 2];
    }

    const mejor = App.plano.pixelBordeMasFuerte(grises, ancho, alto, cx - x0, cy - y0, radio, App.plano.UMBRAL_MAGNITUD_BORDE);
    return mejor ? { x: x0 + mejor.x, y: y0 + mejor.y } : puntoImagen;
  }

  function puntoPantallaDesdeCliente(clientX, clientY) {
    const rect = svgRef.current.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function puntoPantallaDesdeEvento(e) {
    return puntoPantallaDesdeCliente(e.clientX, e.clientY);
  }

  // Helpers puros del pellizco de 2 dedos — trabajan en coordenadas de
  // CLIENTE (clientX/Y), antes de restar el offset del lienzo, porque
  // ahí es donde llegan desde punterosRef.
  function distanciaEntreClientes(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  function puntoMedioDeClientes(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  /** Puntos (espacio MODELO, metros) de los nodos de una habitación, en el orden que ya trae — para el hit-test de arrastre y nada más (el área/perímetro YA están calculados, esto no los vuelve a tocar). */
  function puntosDeHabitacion(h) {
    return h.nodoIds.map((id) => nodos.find((n) => n.id === id)?.punto).filter(Boolean);
  }

  /** La habitación (si alguna) bajo `puntoImagen` — convierte a espacio modelo para el point-in-polygon, ya que ahí es donde viven los nodos. */
  function habitacionEn(puntoImagen) {
    if (!escalaMetrosPorPixel) return null;
    const puntoModelo = App.plano.imagenAModelo(puntoImagen, escalaMetrosPorPixel);
    return habitaciones.find((h) => App.plano.puntoDentroDePoligono(puntoModelo, puntosDeHabitacion(h))) ?? null;
  }

  function alClick(e) {
    if (!imagen || !onClickImagen || arrastreRef.current?.seMovio || arrastreAmbienteRef.current?.seMovio || arrastreMarcadorRef.current?.seMovio) return;
    if (modo === "mover-ambiente" || modo === "mover-equipo" || esModoArrastreRectangulo(modo)) return; // esos modos son solo para arrastrar, un click sin arrastre no hace nada
    let puntoImagen = App.plano.aModelo(puntoPantallaDesdeEvento(e), transformVista);
    if (asistenciaBordes && (modo === "pared" || modo === "conductor" || modo === "calibrar-perimetro" || modo === "espesor")) puntoImagen = ajustarABorde(puntoImagen);
    onClickImagen(puntoImagen);
  }

  function alWheel(e) {
    if (!imagen) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setTransformVista((actual) => App.plano.aplicarZoom(actual, factor, puntoPantallaDesdeEvento(e)));
  }

  function alPointerDown(e) {
    if (!imagen) return;
    punterosRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punterosRef.current.size >= 2) {
      // El 2do dedo cancela cualquier arrastre de 1 dedo que ya
      // hubiera arrancado con el primero (mover vista/ambiente/equipo,
      // o un rectángulo a medio arrastrar) — el pellizco toma el
      // control completo mientras haya 2+ dedos en pantalla.
      arrastreRef.current = null;
      arrastreAmbienteRef.current = null;
      arrastreMarcadorRef.current = null;
      setRectanguloArrastre(null);
      const [p1, p2] = [...punterosRef.current.values()];
      pinchRef.current = { distancia: distanciaEntreClientes(p1, p2), medio: puntoMedioDeClientes(p1, p2) };
      return;
    }
    if (modo === "mover") {
      arrastreRef.current = { x: e.clientX, y: e.clientY, seMovio: false };
      return;
    }
    if (modo === "mover-ambiente" && onArrastrarHabitacion) {
      const puntoImagen = App.plano.aModelo(puntoPantallaDesdeEvento(e), transformVista);
      const habitacion = habitacionEn(puntoImagen);
      if (habitacion) {
        onIniciarArrastre?.();
        arrastreAmbienteRef.current = { habitacionId: habitacion.id, x: e.clientX, y: e.clientY, seMovio: false };
      }
    }
    if (esModoArrastreRectangulo(modo)) {
      const puntoImagen = App.plano.aModelo(puntoPantallaDesdeEvento(e), transformVista);
      setRectanguloArrastre({ inicio: puntoImagen, actual: puntoImagen });
    }
  }

  function alPointerMove(e) {
    if (punterosRef.current.has(e.pointerId)) punterosRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punterosRef.current.size >= 2 && pinchRef.current) {
      // Zoom Y pan de 2 dedos a la vez (igual que cualquier mapa
      // táctil) — funciona en CUALQUIER modo, es un gesto de la VISTA,
      // no de los datos del proyecto. Siempre contra el cuadro
      // ANTERIOR (nunca el total desde que empezó el pellizco), para
      // que no se acumule un error de redondeo ni un salto si el punto
      // medio se desplaza mucho entre cuadros.
      const [p1, p2] = [...punterosRef.current.values()];
      const distanciaNueva = distanciaEntreClientes(p1, p2);
      const medioNuevo = puntoMedioDeClientes(p1, p2);
      if (pinchRef.current.distancia > 0) {
        const factor = distanciaNueva / pinchRef.current.distancia;
        const medioLocalAnterior = puntoPantallaDesdeCliente(pinchRef.current.medio.x, pinchRef.current.medio.y);
        setTransformVista((actual) => {
          const conZoom = App.plano.aplicarZoom(actual, factor, medioLocalAnterior);
          return App.plano.aplicarPan(conZoom, { x: medioNuevo.x - pinchRef.current.medio.x, y: medioNuevo.y - pinchRef.current.medio.y });
        });
      }
      pinchRef.current = { distancia: distanciaNueva, medio: medioNuevo };
      return;
    }
    if (arrastreRef.current && modo === "mover") {
      const dx = e.clientX - arrastreRef.current.x;
      const dy = e.clientY - arrastreRef.current.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) arrastreRef.current.seMovio = true;
      setTransformVista((actual) => App.plano.aplicarPan(actual, { x: dx, y: dy }));
      arrastreRef.current.x = e.clientX;
      arrastreRef.current.y = e.clientY;
      return;
    }
    if (arrastreAmbienteRef.current && modo === "mover-ambiente" && escalaMetrosPorPixel) {
      const dx = e.clientX - arrastreAmbienteRef.current.x;
      const dy = e.clientY - arrastreAmbienteRef.current.y;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        arrastreAmbienteRef.current.seMovio = true;
        // pantalla -> imagen: el pan se cancela en una resta de dos
        // puntos, solo queda dividir por el zoom (ver coordenadas.js).
        const deltaImagen = { x: dx / transformVista.zoom, y: dy / transformVista.zoom };
        const deltaModelo = App.plano.imagenAModelo(deltaImagen, escalaMetrosPorPixel);
        onArrastrarHabitacion(arrastreAmbienteRef.current.habitacionId, deltaModelo);
        arrastreAmbienteRef.current.x = e.clientX;
        arrastreAmbienteRef.current.y = e.clientY;
      }
    }
    if (arrastreMarcadorRef.current && modo === "mover-equipo" && escalaMetrosPorPixel) {
      const dx = e.clientX - arrastreMarcadorRef.current.x;
      const dy = e.clientY - arrastreMarcadorRef.current.y;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        arrastreMarcadorRef.current.seMovio = true;
        const deltaImagen = { x: dx / transformVista.zoom, y: dy / transformVista.zoom };
        const deltaModelo = App.plano.imagenAModelo(deltaImagen, escalaMetrosPorPixel);
        onArrastrarMarcador(arrastreMarcadorRef.current.marcadorId, deltaModelo);
        arrastreMarcadorRef.current.x = e.clientX;
        arrastreMarcadorRef.current.y = e.clientY;
      }
    }
    if (rectanguloArrastre && esModoArrastreRectangulo(modo)) {
      const puntoImagen = App.plano.aModelo(puntoPantallaDesdeEvento(e), transformVista);
      setRectanguloArrastre({ inicio: rectanguloArrastre.inicio, actual: puntoImagen });
    }
  }

  function alPointerUp(e) {
    if (e) punterosRef.current.delete(e.pointerId);
    if (punterosRef.current.size < 2) pinchRef.current = null;
    arrastreRef.current = null;
    arrastreMarcadorRef.current = null;
    arrastreAmbienteRef.current = null;
    if (rectanguloArrastre && esModoArrastreRectangulo(modo) && onTrazarRectangulo) {
      onTrazarRectangulo(rectanguloArrastre.inicio, rectanguloArrastre.actual);
    }
    setRectanguloArrastre(null);
  }

  function zoomBoton(factor) {
    const centro = { x: tamanoCanvas.ancho / 2, y: tamanoCanvas.alto / 2 };
    setTransformVista((actual) => App.plano.aplicarZoom(actual, factor, centro));
  }

  function ajustarVista() {
    if (!imagen) return;
    setTransformVista(App.plano.ajustarAVentana(imagen.anchoPx, imagen.altoPx, tamanoCanvas.ancho, tamanoCanvas.alto));
  }

  // píxeles de imagen de un punto en metros (modelo) — para dibujar.
  function px(puntoModelo) {
    return escalaMetrosPorPixel ? App.plano.modeloAImagen(puntoModelo, escalaMetrosPorPixel) : puntoModelo;
  }

  const grosorLinea = 3 / transformVista.zoom;
  const radioNodo = 5 / transformVista.zoom;

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={contenedorRef}
        style={{ width: "100%", height: ocuparAltoDisponible ? "calc(100vh - 140px)" : 480, background: "#0d0c0a", border: `1px solid ${colores.border}`, borderRadius: 4, overflow: "hidden", touchAction: imagen ? "none" : "pan-y" }}
      >
        {!imagen ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: colores.textDim, fontSize: 13 }}>
            Cargá un plano para empezar.
          </div>
        ) : (
          <svg
            ref={svgRef}
            width={tamanoCanvas.ancho}
            height={tamanoCanvas.alto}
            style={{ display: "block", cursor: modo === "mover" || modo === "mover-ambiente" ? "grab" : "crosshair" }}
            onClick={alClick}
            onWheel={alWheel}
            onPointerDown={alPointerDown}
            onPointerMove={alPointerMove}
            onPointerUp={alPointerUp}
            onPointerCancel={alPointerUp}
            onPointerLeave={alPointerUp}
          >
            <defs>
              {/* Flecha de las conexiones del diagrama superpuestas — ver
                  nota junto a conexionesDiagrama más abajo. */}
              <marker id="flecha-plano-diagrama" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill={colores.textDim} />
              </marker>
            </defs>
            <g transform={`translate(${transformVista.panX},${transformVista.panY}) scale(${transformVista.zoom})`}>
              {/* Ocultar la imagen de fondo (usuario, 2026-11-24: "una
                  vez realizado el trazado y calibrado... quitarlo...
                  para tener una imagen más nítida y profesional") —
                  solo visual, el dato sigue ahí (recalibrar, exportar
                  DXF, etc. no dependen de que esté mostrándose). */}
              {mostrarImagenFondo && (
                <image href={imagen.dataUrl} x={0} y={0} width={imagen.anchoPx} height={imagen.altoPx} />
              )}

              {/* Conexiones del diagrama unifilar superpuestas sobre el plano
                  (usuario, 2026-11-22: "continuemos con diagrama unifilar y
                  planos como dos lienzos separados" -> "Superponer el diagrama
                  SOBRE el plano"). Ya vienen resueltas a puntos en espacio
                  MODELO (metros) por PlanoMediator.conexionesDiagramaEnPlano —
                  este componente solo las dibuja, igual que cualquier otro
                  segmento. Es una aproximación en línea recta entre las
                  posiciones físicas de las dos entidades (NO una ruta trazada
                  real), por eso un trazo punto-raya distinto de pared (sólido)
                  y conductor (punteado) — para que no se confunda con ninguno. */}
              {conexionesDiagrama.map((cx) => {
                const a = px(cx.puntoOrigen);
                const b = px(cx.puntoDestino);
                return (
                  <line
                    key={`diag-${cx.id}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={colores.textDim}
                    strokeWidth={grosorLinea * 0.6}
                    strokeDasharray={`${grosorLinea * 2} ${grosorLinea} ${grosorLinea * 0.3} ${grosorLinea}`}
                    strokeLinecap="round"
                    markerEnd="url(#flecha-plano-diagrama)"
                    opacity={0.8}
                  />
                );
              })}

              {segmentos.map((seg) => {
                const nodoA = nodos.find((n) => n.id === seg.nodoAId);
                const nodoB = nodos.find((n) => n.id === seg.nodoBId);
                if (!nodoA || !nodoB) return null;
                const a = px(nodoA.punto);
                const b = px(nodoB.punto);
                const enTrazo = nodoIdsTrazoActual.includes(seg.nodoAId) && nodoIdsTrazoActual.includes(seg.nodoBId);
                const esConductor = seg.tipo === "conductor";
                return (
                  <React.Fragment key={seg.id}>
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={enTrazo ? colores.warn : esConductor ? colores.copper : colores.ok}
                      strokeWidth={esConductor ? grosorLinea * 0.7 : grosorLinea}
                      strokeDasharray={esConductor ? `${grosorLinea} ${grosorLinea}` : undefined}
                      strokeLinecap="round"
                    />
                    {/* Espesor medido (usuario, 2026-11-20: "medir el ancho visible de
                        una pared, 2 clicks") — solo registro visual, no alimenta ningún
                        cálculo todavía. */}
                    {seg.tipo === "pared" && seg.espesorM > 0 && (
                      <text
                        x={(a.x + b.x) / 2}
                        y={(a.y + b.y) / 2 - 4 / transformVista.zoom}
                        textAnchor="middle"
                        fontSize={11 / transformVista.zoom}
                        fill={colores.textDim}
                      >
                        {(seg.espesorM * 100).toFixed(1)}cm
                      </text>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Vínculo interruptor conmutado → luminaria que controla
                  (usuario, 2026-11-25: "ubicar geográficamente los
                  interruptores conmutados junto su punto de luz") —
                  conector punteado puramente visual, antes de dibujar los
                  marcadores para que el ícono quede encima de la línea. Si
                  la luminaria vinculada ya no existe (se eliminó), no se
                  dibuja nada — referencia suave, sin romper nada. */}
              {marcadoresEquipo
                .filter((m) => m.tipo === "interruptor_conmutado" && m.controlaMarcadorId)
                .map((interruptor) => {
                  const luminaria = marcadoresEquipo.find((m) => m.id === interruptor.controlaMarcadorId);
                  if (!luminaria) return null;
                  const a = px(interruptor.punto);
                  const b = px(luminaria.punto);
                  return (
                    <line
                      key={`conmutado-${interruptor.id}`}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={colores.textDim}
                      strokeWidth={1.3 / transformVista.zoom}
                      strokeDasharray={`${4 / transformVista.zoom} ${4 / transformVista.zoom}`}
                      pointerEvents="none"
                    />
                  );
                })}

              {marcadoresEquipo.map((marcador) => {
                const p = px(marcador.punto);
                const tamano = tamanoMarcadorPx(escalaMetrosPorPixel, transformVista.zoom);
                // Solo intercepta el click (y detiene su propagación) en los
                // modos que de verdad hacen algo con un marcador —
                // "triangular" (usarlo de referencia) y "eliminar" (borrarlo).
                // Usuario, 2026-11-22 ("pegar una ruta de conductor a la
                // posición EXACTA de un equipo marcado"): en cualquier OTRO
                // modo (sobre todo "conductor") el click debe LLEGAR al
                // handler general del lienzo para que agregarNodoPlano
                // pueda pegarse al punto del marcador — antes se perdía acá
                // sin más, aunque alClickMarcador no fuera a hacer nada con
                // él (mismo problema latente para "pared"/"ambiente", no
                // solo para conductor).
                const marcadorInterceptaClick = onClickMarcador && (modo === "triangular" || modo === "eliminar");
                // "Mover equipo" (usuario, 2026-11-24) — arranca el
                // arrastre JUSTO en el ícono del marcador (a diferencia
                // de "mover-ambiente", que acepta un click en cualquier
                // punto dentro del polígono): un marcador es un punto,
                // no tiene "adentro". stopPropagation para que el
                // onPointerDown genérico del lienzo (modo "mover", pan
                // de vista) no también dispare.
                const marcadorArrastrable = modo === "mover-equipo" && onArrastrarMarcador;
                return (
                  <g
                    key={marcador.id}
                    transform={`translate(${p.x - tamano / 2},${p.y - tamano / 2})`}
                    style={{ cursor: marcadorInterceptaClick ? "pointer" : marcadorArrastrable ? "grab" : undefined }}
                    onClick={(e) => {
                      if (!marcadorInterceptaClick) return;
                      e.stopPropagation();
                      onClickMarcador(marcador);
                    }}
                    onPointerDown={(e) => {
                      if (!marcadorArrastrable) return;
                      e.stopPropagation();
                      onIniciarArrastre?.();
                      arrastreMarcadorRef.current = { marcadorId: marcador.id, x: e.clientX, y: e.clientY, seMovio: false };
                    }}
                  >
                    <circle cx={tamano / 2} cy={tamano / 2} r={tamano / 2 + 3 / transformVista.zoom} fill={colores.panel} opacity={0.85} />
                    <SimboloDiagrama tipo={marcador.tipo} x={0} y={0} size={tamano} color={colorDeEquipo(marcador.tipo)} />
                  </g>
                );
              })}

              {nodos.map((nodo) => {
                const p = px(nodo.punto);
                const enTrazo = nodoIdsTrazoActual.includes(nodo.id);
                return <circle key={nodo.id} cx={p.x} cy={p.y} r={enTrazo ? radioNodo * 1.4 : radioNodo} fill={enTrazo ? colores.copper : colores.ok} />;
              })}

              {/* Puntos guía pendientes — mismo dibujo para la calibración (2 puntos)
                  y para la corrección de perspectiva (4 puntos, ver modo "perspectiva"):
                  un círculo por punto + la poligonal abierta que los va conectando; con
                  4 puntos se cierra el cuadrilátero para que se vea la forma completa
                  antes de confirmar. */}
              {puntosGuiaPendientes.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={radioNodo * 1.4} fill="none" stroke={colores.warn} strokeWidth={grosorLinea} />
              ))}
              {puntosGuiaPendientes.length >= 2 &&
                puntosGuiaPendientes.slice(1).map((p, i) => (
                  <line
                    key={i}
                    x1={puntosGuiaPendientes[i].x}
                    y1={puntosGuiaPendientes[i].y}
                    x2={p.x}
                    y2={p.y}
                    stroke={colores.warn}
                    strokeWidth={grosorLinea}
                    strokeDasharray={`${grosorLinea * 2} ${grosorLinea * 2}`}
                  />
                ))}
              {puntosGuiaPendientes.length === 4 && (
                <line
                  x1={puntosGuiaPendientes[3].x}
                  y1={puntosGuiaPendientes[3].y}
                  x2={puntosGuiaPendientes[0].x}
                  y2={puntosGuiaPendientes[0].y}
                  stroke={colores.warn}
                  strokeWidth={grosorLinea}
                  strokeDasharray={`${grosorLinea * 2} ${grosorLinea * 2}`}
                />
              )}

              {/* Vista previa en vivo del rectángulo que se está arrastrando
                  (modo "rectangulo") — puramente visual, el ambiente real
                  recién se crea al soltar (ver alPointerUp → onTrazarRectangulo).
                  Mismo espacio IMAGEN que puntosGuiaPendientes, sin pasar por px(). */}
              {rectanguloArrastre && (
                <rect
                  x={Math.min(rectanguloArrastre.inicio.x, rectanguloArrastre.actual.x)}
                  y={Math.min(rectanguloArrastre.inicio.y, rectanguloArrastre.actual.y)}
                  width={Math.abs(rectanguloArrastre.actual.x - rectanguloArrastre.inicio.x)}
                  height={Math.abs(rectanguloArrastre.actual.y - rectanguloArrastre.inicio.y)}
                  fill={colores.ok}
                  fillOpacity={0.12}
                  stroke={colores.ok}
                  strokeWidth={grosorLinea}
                  strokeDasharray={`${grosorLinea * 2} ${grosorLinea * 2}`}
                />
              )}

              {/* Paredes candidatas (usuario, 2026-11-20, "asistencia mejorada") —
                  sugerencias, no datos del proyecto todavía: un click las confirma
                  (crea la pared real), nada se crea solo. Ya vienen en espacio
                  IMAGEN (píxeles), igual que puntosGuiaPendientes — sin pasar por px(). */}
              {paredesCandidatas.map((c, i) => (
                <line
                  key={`pc-${i}`}
                  x1={c.x1}
                  y1={c.y1}
                  x2={c.x2}
                  y2={c.y2}
                  stroke={colores.copper}
                  strokeWidth={grosorLinea * 1.3}
                  strokeDasharray={`${grosorLinea * 2.5} ${grosorLinea * 1.5}`}
                  strokeLinecap="round"
                  style={{ cursor: onClickParedCandidata ? "pointer" : "default" }}
                  onClick={(e) => {
                    if (!onClickParedCandidata) return;
                    e.stopPropagation();
                    onClickParedCandidata(c);
                  }}
                />
              ))}
              {puertasCandidatas.map((c, i) => (
                <line
                  key={`pt-${i}`}
                  x1={c.x1}
                  y1={c.y1}
                  x2={c.x2}
                  y2={c.y2}
                  stroke={colores.warn}
                  strokeWidth={grosorLinea * 1.3}
                  strokeDasharray={`${grosorLinea} ${grosorLinea}`}
                  strokeLinecap="round"
                />
              ))}

              {/* Candidatos de triangulación (usuario, 2026-11-21) — 1 o 2
                  soluciones geométricas pendientes de confirmar: el siguiente
                  click en el lienzo (en espacio imagen, ya convertido por
                  onClickImagen) elige la más cercana a ese click y recién ahí
                  se crea el equipo real. Puramente visual, nunca se crea solo. */}
              {candidatosTriangulacion.map((c, i) => (
                <circle key={`ct-${i}`} cx={c.x} cy={c.y} r={radioNodo * 2} fill="none" stroke={colores.copper} strokeWidth={grosorLinea} strokeDasharray={`${grosorLinea} ${grosorLinea}`} />
              ))}
            </g>
          </svg>
        )}
      </div>

      {imagen && (
        <div style={{ position: "absolute", bottom: 10, right: 10, display: "flex", gap: 4 }}>
          <button type="button" onClick={() => zoomBoton(1 / 1.3)} style={botonZoomEstilo}>
            −
          </button>
          <button type="button" onClick={ajustarVista} style={{ ...botonZoomEstilo, width: "auto", padding: "0 10px", fontSize: 10.5 }}>
            Ajustar
          </button>
          <button type="button" onClick={() => zoomBoton(1.3)} style={botonZoomEstilo}>
            +
          </button>
        </div>
      )}
    </div>
  );
});

export default PlanoCanvas;

const botonZoomEstilo = {
  width: 30,
  height: 30,
  borderRadius: 3,
  border: `1px solid ${colores.border}`,
  background: colores.panel,
  color: colores.textMain,
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
};
