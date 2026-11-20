import React, { useEffect, useRef, useState } from "react";
import { colores } from "../styles/colores";
import { ApplicationMediator as App } from "../core/ApplicationMediator.js";

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
export default function PlanoCanvas({
  imagen,
  nodos = [],
  segmentos = [],
  escalaMetrosPorPixel,
  puntosGuiaPendientes = [],
  nodoIdsTrazoActual = [],
  modo,
  asistenciaBordes = false,
  onClickImagen,
}) {
  const contenedorRef = useRef(null);
  const svgRef = useRef(null);
  const [tamanoCanvas, setTamanoCanvas] = useState({ ancho: 0, alto: 0 });
  const [transformVista, setTransformVista] = useState(() => App.plano.transformVistaInicial());
  const arrastreRef = useRef(null); // { xInicial, yInicial, transformInicial } — solo en modo "mover"
  // Canvas oculto con los píxeles de la imagen cargada — solo para que
  // alClick pueda leer un parche chico y "pegarse" al borde más
  // cercano (ver modules/plano/deteccionBordes.js). Se arma UNA vez
  // por imagen, no en cada click.
  const contextoPixelesRef = useRef(null);

  // Mide el contenedor al montar y en cada resize/orientation-change —
  // así "ajustar a ventana" siempre usa el tamaño REAL del dispositivo
  // actual, nunca uno guardado de otro dispositivo.
  useEffect(() => {
    function medir() {
      if (!contenedorRef.current) return;
      const rect = contenedorRef.current.getBoundingClientRect();
      setTamanoCanvas({ ancho: rect.width, alto: rect.height });
    }
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

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

  function puntoPantallaDesdeEvento(e) {
    const rect = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function alClick(e) {
    if (!imagen || !onClickImagen || arrastreRef.current?.seMovio) return;
    let puntoImagen = App.plano.aModelo(puntoPantallaDesdeEvento(e), transformVista);
    if (asistenciaBordes && modo === "pared") puntoImagen = ajustarABorde(puntoImagen);
    onClickImagen(puntoImagen);
  }

  function alWheel(e) {
    if (!imagen) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setTransformVista((actual) => App.plano.aplicarZoom(actual, factor, puntoPantallaDesdeEvento(e)));
  }

  function alPointerDown(e) {
    if (modo !== "mover" || !imagen) return;
    arrastreRef.current = { x: e.clientX, y: e.clientY, seMovio: false };
  }

  function alPointerMove(e) {
    if (!arrastreRef.current || modo !== "mover") return;
    const dx = e.clientX - arrastreRef.current.x;
    const dy = e.clientY - arrastreRef.current.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) arrastreRef.current.seMovio = true;
    setTransformVista((actual) => App.plano.aplicarPan(actual, { x: dx, y: dy }));
    arrastreRef.current.x = e.clientX;
    arrastreRef.current.y = e.clientY;
  }

  function alPointerUp() {
    arrastreRef.current = null;
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
        style={{ width: "100%", height: 480, background: "#0d0c0a", border: `1px solid ${colores.border}`, borderRadius: 4, overflow: "hidden", touchAction: modo === "mover" ? "none" : "pan-y" }}
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
            style={{ display: "block", cursor: modo === "mover" ? "grab" : "crosshair" }}
            onClick={alClick}
            onWheel={alWheel}
            onPointerDown={alPointerDown}
            onPointerMove={alPointerMove}
            onPointerUp={alPointerUp}
            onPointerLeave={alPointerUp}
          >
            <g transform={`translate(${transformVista.panX},${transformVista.panY}) scale(${transformVista.zoom})`}>
              <image href={imagen.dataUrl} x={0} y={0} width={imagen.anchoPx} height={imagen.altoPx} />

              {segmentos.map((seg) => {
                const nodoA = nodos.find((n) => n.id === seg.nodoAId);
                const nodoB = nodos.find((n) => n.id === seg.nodoBId);
                if (!nodoA || !nodoB) return null;
                const a = px(nodoA.punto);
                const b = px(nodoB.punto);
                const enTrazo = nodoIdsTrazoActual.includes(seg.nodoAId) && nodoIdsTrazoActual.includes(seg.nodoBId);
                return (
                  <line
                    key={seg.id}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={enTrazo ? colores.copper : colores.ok}
                    strokeWidth={grosorLinea}
                    strokeLinecap="round"
                  />
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
}

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
