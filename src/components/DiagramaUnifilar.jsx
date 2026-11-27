import React, { useState, useRef } from "react";
import { colores } from "../styles/colores";
import { ApplicationMediator as App } from "../core/ApplicationMediator.ts";
import { ContenidoSvgDiagrama } from "./DiagramaSvgContenido.jsx";

// Editor mínimo del diagrama unifilar — Fase 3 de la spec del usuario
// (2026-11-20, segunda ronda: "primero lo mínimo"). Símbolos dibujados
// a mano (ver simbolosDiagrama.jsx) tras investigar fuentes externas y
// no encontrar ninguna que cubriera el catálogo completo con licencia
// y estilo consistentes — decisión explícita del usuario: "Dibujalo tu
// mismo".
//
// ZOOM/PAN Y AUTOORGANIZACIÓN (usuario, 2026-11-20, segundo pedido de
// su lista para el diagrama): el zoom/pan reusa el MISMO núcleo
// matemático que ya usa Plano (modules/geometria/vistaZoomPan.js, ver
// PlanoCanvas.jsx para el patrón original) — rueda del mouse (o los
// botones +/−) para zoom hacia donde apunta el cursor, arrastrar
// espacio VACÍO del lienzo en modo "Mover" para desplazar la vista
// (arrastrar un NODO en ese mismo modo lo mueve a él, no la vista —
// se distinguen porque el mousedown de un nodo hace stopPropagation
// antes de llegar acá). La autoorganización (modules/diagrama/
// autoorganizar.js) acomoda los nodos en capas según el sentido de las
// conexiones — nunca se dispara sola, es un botón; se puede seguir
// moviendo nodos a mano después.
//
// Reusa el modelo de datos y la validación YA construidos
// (modules/diagrama/*, DiagramaMediator) — este componente es
// puramente la vista, no duplica ninguna regla acá.
//
// SINCRONIZACIÓN CON LA TABLA (2026-11-19, "sincronización de
// diagramas con la tabla de circuitos"): un nodo cuyo tipo tiene
// entidadVinculada (tablero_electrico, contacto/luminaria/motor/carga_
// especial, generador/banco_baterias) puede vincularse a su entidad
// real (tablero/equipo/fuenteEnergia) — modo "Vincular", o al crearlo.
// Una vez vinculado, el NOMBRE que se dibuja es el de la entidad real
// (vivo, leído en cada render vía DiagramaMediator.resolverEntidad), no
// una copia — así sigue el modelo canónico de ARCHITECTURE.md §9: el
// diagrama es una VISTA, nunca una segunda fuente de verdad. Si la
// entidad vinculada se borra en la tabla, el hook (useCircuitos.js)
// desvincula el nodo automáticamente (entidadId -> null), nunca queda
// apuntando a un id muerto. La relación es 1 a 1 (una entidad no puede
// estar vinculada a dos nodos a la vez) — DiagramaMediator.
// candidatosEntidad ya excluye las que están en uso. Vincular es
// OPCIONAL siempre: un nodo sin vínculo sigue siendo válido (se dibuja
// la topología antes de tener todos los datos reales cargados, mismo
// criterio ya usado en fuentesEnergia/conmutación).

export default function DiagramaUnifilar({
  nodosDiagrama,
  crearNodoDiagrama,
  editarNodoDiagrama,
  eliminarNodoDiagrama,
  autoorganizarDiagrama,
  conexionesDiagrama,
  crearConexionDiagrama,
  eliminarConexionDiagrama,
  tableros = [],
  equipos = [],
  circuitos = [],
  fuentesEnergia = [],
  transformadores = [],
}) {
  const svgRef = useRef(null);
  const categorias = App.diagrama.componentesPorCategoria();
  const primeraCategoria = Object.keys(categorias)[0];
  const [tipoSeleccionado, setTipoSeleccionado] = useState(categorias[primeraCategoria]?.[0]?.id ?? "");
  const [nombreNuevoNodo, setNombreNuevoNodo] = useState("");
  const [entidadNuevoNodo, setEntidadNuevoNodo] = useState(""); // id de tablero/equipo/fuenteEnergia a vincular, o "" = sin vincular
  const [modo, setModo] = useState("mover"); // "mover" | "conectar" | "eliminar" | "vincular"
  const [origenPendiente, setOrigenPendiente] = useState(null);
  const [arrastre, setArrastre] = useState(null); // {nodoId, offsetX, offsetY}
  const [posicionesArrastre, setPosicionesArrastre] = useState({}); // nodoId -> {x,y} mientras se arrastra
  const [aviso, setAviso] = useState("");
  const [nodoVinculando, setNodoVinculando] = useState(null); // id del nodo cuyo vínculo se está editando
  const [entidadEdicion, setEntidadEdicion] = useState("");
  const [transformVista, setTransformVista] = useState(() => App.diagrama.transformVistaInicial());
  const arrastreVistaRef = useRef(null); // {x,y} último punto de PANTALLA mientras se arrastra la VISTA (pan) — null = no se está arrastrando

  const entidadesPorRef = { tableros, equipos, fuentesEnergia, transformadores };

  function mostrarAviso(texto) {
    setAviso(texto);
    setTimeout(() => setAviso(""), 5000);
  }

  /** Nombre/contexto legible de una entidad candidata, para las listas de vínculo. */
  function etiquetaEntidad(tipoNodo, entidad) {
    const comp = App.diagrama.obtenerComponente(tipoNodo);
    if (comp?.entidadVinculada === "equipo") {
      const circuito = circuitos.find((c) => c.id === entidad.circuitoId);
      const tablero = circuito ? tableros.find((t) => t.id === circuito.tableroId) : null;
      const contexto = [circuito?.nombre, tablero?.nombre].filter(Boolean).join(" · ");
      return contexto ? `${entidad.nombre || "Equipo sin nombre"} (${contexto})` : entidad.nombre || "Equipo sin nombre";
    }
    return entidad.nombre || "(sin nombre)";
  }

  function posicionPorDefecto() {
    const n = nodosDiagrama.length;
    return { x: 40 + (n % 6) * 150, y: 20 + Math.floor(n / 6) * 125 };
  }

  function agregarNodo() {
    const comp = App.diagrama.obtenerComponente(tipoSeleccionado);
    if (!comp) return;
    crearNodoDiagrama({
      tipo: tipoSeleccionado,
      nombre: nombreNuevoNodo.trim() || comp.nombre,
      posicion: posicionPorDefecto(),
      entidadId: entidadNuevoNodo || null,
    });
    setNombreNuevoNodo("");
    setEntidadNuevoNodo("");
  }

  function puntoPantalla(e) {
    const rect = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  /** Punto del evento, YA convertido de pantalla a espacio MODELO (donde viven nodo.posicion) — divide/resta el zoom/pan actual. */
  function coordenadasSvg(e) {
    return App.diagrama.aModelo(puntoPantalla(e), transformVista);
  }

  function posicionDe(nodo) {
    return posicionesArrastre[nodo.id] ?? nodo.posicion;
  }

  /** Click en el LIENZO (no en un nodo — el mousedown de un nodo hace stopPropagation antes de llegar acá) — en modo "Mover", arranca el pan de la vista. */
  function alMouseDownSvg(e) {
    if (modo === "mover") {
      arrastreVistaRef.current = { x: e.clientX, y: e.clientY };
    }
  }

  function alWheelSvg(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setTransformVista((actual) => App.diagrama.aplicarZoom(actual, factor, puntoPantalla(e)));
  }

  function zoomBoton(factor) {
    const rect = svgRef.current?.getBoundingClientRect();
    const centro = rect ? { x: rect.width / 2, y: rect.height / 2 } : { x: 0, y: 0 };
    setTransformVista((actual) => App.diagrama.aplicarZoom(actual, factor, centro));
  }

  function restablecerVista() {
    setTransformVista(App.diagrama.transformVistaInicial());
  }

  function alMouseDownNodo(e, nodo) {
    e.stopPropagation();
    if (modo === "eliminar") {
      eliminarNodoDiagrama(nodo.id);
      if (origenPendiente === nodo.id) setOrigenPendiente(null);
      return;
    }
    if (modo === "vincular") {
      const comp = App.diagrama.obtenerComponente(nodo.tipo);
      if (!comp?.entidadVinculada) {
        mostrarAviso(`"${comp?.nombre ?? nodo.tipo}" no se vincula a datos del proyecto — es un nodo puramente de diagrama.`);
        return;
      }
      setNodoVinculando(nodo.id);
      setEntidadEdicion(nodo.entidadId ?? "");
      return;
    }
    if (modo === "conectar") {
      if (!origenPendiente) {
        setOrigenPendiente(nodo.id);
      } else if (origenPendiente === nodo.id) {
        setOrigenPendiente(null);
      } else {
        const resultado = crearConexionDiagrama({ nodoOrigenId: origenPendiente, nodoDestinoId: nodo.id });
        if (!resultado.ok) mostrarAviso(resultado.motivo);
        setOrigenPendiente(null);
      }
      return;
    }
    const pos = coordenadasSvg(e);
    setArrastre({ nodoId: nodo.id, offsetX: pos.x - nodo.posicion.x, offsetY: pos.y - nodo.posicion.y });
  }

  function alMouseMoveSvg(e) {
    if (arrastreVistaRef.current) {
      const dx = e.clientX - arrastreVistaRef.current.x;
      const dy = e.clientY - arrastreVistaRef.current.y;
      setTransformVista((actual) => App.diagrama.aplicarPan(actual, { x: dx, y: dy }));
      arrastreVistaRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (!arrastre) return;
    const pos = coordenadasSvg(e);
    setPosicionesArrastre((prev) => ({
      ...prev,
      [arrastre.nodoId]: { x: Math.max(0, pos.x - arrastre.offsetX), y: Math.max(0, pos.y - arrastre.offsetY) },
    }));
  }

  function alMouseUpSvg() {
    arrastreVistaRef.current = null;
    if (arrastre) {
      const posicionFinal = posicionesArrastre[arrastre.nodoId];
      if (posicionFinal) editarNodoDiagrama(arrastre.nodoId, { posicion: posicionFinal });
      setArrastre(null);
    }
  }

  const botonModo = (valor, label) => (
    <button
      type="button"
      onClick={() => {
        setModo(valor);
        setOrigenPendiente(null);
        setNodoVinculando(null);
      }}
      style={{
        padding: "5px 10px",
        borderRadius: 3,
        border: `1px solid ${modo === valor ? colores.copper : colores.border}`,
        background: modo === valor ? colores.copper : "transparent",
        color: modo === valor ? colores.textSobreAcento : colores.textDim,
        fontWeight: 600,
        fontSize: 11.5,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: 14 }}>
      <div style={{ fontSize: 11, color: colores.textDim, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
        Diagrama unifilar
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <select
          value={tipoSeleccionado}
          onChange={(e) => {
            setTipoSeleccionado(e.target.value);
            setEntidadNuevoNodo("");
          }}
          style={{ padding: "6px 8px", borderRadius: 3, border: `1px solid ${colores.border}`, background: colores.bg, color: colores.textMain, fontSize: 12 }}
        >
          {Object.entries(categorias).map(([cat, items]) => (
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
          value={nombreNuevoNodo}
          onChange={(e) => setNombreNuevoNodo(e.target.value)}
          placeholder="Nombre (ej. Q1, TD-01)"
          style={{ padding: "6px 8px", borderRadius: 3, border: `1px solid ${colores.border}`, background: colores.bg, color: colores.textMain, fontSize: 12, width: 140 }}
        />
        {App.diagrama.obtenerComponente(tipoSeleccionado)?.entidadVinculada && (
          <select
            value={entidadNuevoNodo}
            onChange={(e) => setEntidadNuevoNodo(e.target.value)}
            style={{ padding: "6px 8px", borderRadius: 3, border: `1px solid ${colores.border}`, background: colores.bg, color: colores.textMain, fontSize: 12, maxWidth: 220 }}
          >
            <option value="">— Vincular a (opcional) —</option>
            {App.diagrama
              .candidatosEntidad(tipoSeleccionado, { tableros, equipos, fuentesEnergia, transformadores, nodos: nodosDiagrama })
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {etiquetaEntidad(tipoSeleccionado, c)}
                </option>
              ))}
          </select>
        )}
        <button
          type="button"
          onClick={agregarNodo}
          style={{ padding: "6px 10px", borderRadius: 3, border: "none", background: colores.copper, color: colores.textSobreAcento, fontWeight: 700, fontSize: 12, cursor: "pointer" }}
        >
          + Agregar
        </button>

        <div style={{ flex: 1 }} />

        {autoorganizarDiagrama && (
          <button
            type="button"
            onClick={autoorganizarDiagrama}
            disabled={nodosDiagrama.length === 0}
            title="Acomoda los nodos en capas según el sentido de las conexiones — se puede seguir moviendo a mano después"
            style={{
              padding: "5px 10px",
              borderRadius: 3,
              border: `1px solid ${colores.border}`,
              background: "transparent",
              color: nodosDiagrama.length === 0 ? colores.textDim : colores.copper,
              fontWeight: 600,
              fontSize: 11.5,
              cursor: nodosDiagrama.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            ⇅ Autoorganizar
          </button>
        )}

        {botonModo("mover", "Mover")}
        {botonModo("conectar", "Conectar")}
        {botonModo("vincular", "Vincular")}
        {botonModo("eliminar", "Eliminar")}
      </div>

      <div style={{ fontSize: 11, color: colores.textDim, marginBottom: 6 }}>
        {modo === "mover" && "Arrastrá un nodo para reposicionarlo, o el lienzo vacío para mover la vista. Rueda del mouse (o los botones +/−) para zoom."}
        {modo === "conectar" &&
          (origenPendiente
            ? "Hacé click en el nodo de destino (o de nuevo en el mismo para cancelar)."
            : "Hacé click en el nodo de origen, después en el de destino.")}
        {modo === "vincular" && "Hacé click en un nodo (tablero, equipo o fuente de energía) para vincularlo con su dato real del proyecto."}
        {modo === "eliminar" && "Hacé click en un nodo o una conexión para eliminarlo."}
      </div>

      {nodoVinculando &&
        (() => {
          const nodo = nodosDiagrama.find((n) => n.id === nodoVinculando);
          if (!nodo) return null;
          const candidatos = App.diagrama.candidatosEntidad(nodo.tipo, {
            tableros,
            equipos,
            fuentesEnergia,
            transformadores,
            nodos: nodosDiagrama,
            nodoId: nodo.id,
          });
          return (
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
                background: colores.bg,
                border: `1px solid ${colores.border}`,
                borderRadius: 3,
                padding: 8,
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 11.5, color: colores.textDim }}>Vincular "{nodo.nombre}" a:</span>
              <select
                value={entidadEdicion}
                onChange={(e) => setEntidadEdicion(e.target.value)}
                style={{ padding: "5px 7px", borderRadius: 3, border: `1px solid ${colores.border}`, background: colores.panel, color: colores.textMain, fontSize: 12 }}
              >
                <option value="">— Sin vincular —</option>
                {candidatos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {etiquetaEntidad(nodo.tipo, c)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  editarNodoDiagrama(nodo.id, { entidadId: entidadEdicion || null });
                  setNodoVinculando(null);
                }}
                style={{ padding: "5px 10px", borderRadius: 3, border: "none", background: colores.copper, color: colores.textSobreAcento, fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setNodoVinculando(null)}
                style={{ padding: "5px 10px", borderRadius: 3, border: `1px solid ${colores.border}`, background: "transparent", color: colores.textDim, fontSize: 11.5, cursor: "pointer" }}
              >
                Cancelar
              </button>
            </div>
          );
        })()}

      {aviso && (
        <div style={{ fontSize: 11.5, color: colores.error, background: colores.errorFondo, border: `1px solid ${colores.errorBorde}`, borderRadius: 3, padding: "6px 8px", marginBottom: 8 }}>
          ⚠ {aviso}
        </div>
      )}

      <div style={{ position: "relative" }}>
        <svg
          ref={svgRef}
          width="100%"
          height={420}
          style={{ background: colores.bg, border: `1px solid ${colores.border}`, borderRadius: 4, display: "block", cursor: modo === "mover" ? "grab" : "default" }}
          onMouseDown={alMouseDownSvg}
          onMouseMove={alMouseMoveSvg}
          onMouseUp={alMouseUpSvg}
          onMouseLeave={alMouseUpSvg}
          onWheel={alWheelSvg}
        >
          <g transform={`translate(${transformVista.panX},${transformVista.panY}) scale(${transformVista.zoom})`}>
            <ContenidoSvgDiagrama
              nodosDiagrama={nodosDiagrama}
              conexionesDiagrama={conexionesDiagrama}
              entidadesPorRef={entidadesPorRef}
              posicionDe={posicionDe}
              esSeleccionado={(id) => origenPendiente === id || nodoVinculando === id}
              onMouseDownNodo={alMouseDownNodo}
              onClickConexion={(cx) => modo === "eliminar" && eliminarConexionDiagrama(cx.id)}
              cursorDeNodo={() => (modo === "mover" ? "grab" : "pointer")}
            />
          </g>
        </svg>

        <div style={{ position: "absolute", bottom: 10, right: 10, display: "flex", gap: 4 }}>
          <button type="button" onClick={() => zoomBoton(1 / 1.3)} style={botonZoomEstilo} title="Alejar">
            −
          </button>
          <button type="button" onClick={restablecerVista} style={{ ...botonZoomEstilo, width: "auto", padding: "0 10px", fontSize: 10.5 }} title="Restablecer zoom y posición">
            Restablecer
          </button>
          <button type="button" onClick={() => zoomBoton(1.3)} style={botonZoomEstilo} title="Acercar">
            +
          </button>
        </div>
      </div>

      <div style={{ fontSize: 10.5, color: colores.textDim, lineHeight: 1.4, marginTop: 8 }}>
        Prototipo sin cálculos todavía — solo registra la topología (qué se conecta con qué).
      </div>
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
