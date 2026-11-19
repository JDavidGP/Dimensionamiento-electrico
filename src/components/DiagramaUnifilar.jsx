import React, { useState, useRef } from "react";
import { colores, fuentes } from "../styles/colores";
import { ApplicationMediator as App } from "../core/ApplicationMediator.js";
import { SimboloDiagrama } from "./simbolosDiagrama.jsx";

// Editor mínimo del diagrama unifilar — Fase 3 de la spec del usuario
// (2026-11-20, segunda ronda: "primero lo mínimo"). Sin cálculos,
// sin autoorganización, sin zoom/pan todavía — exactamente lo que
// pidió: área de dibujo, agregar nodos del catálogo (Fase 1), crear
// conexiones arrastrando/clickeando (validadas por el motor de reglas
// de Fase 2). Símbolos dibujados a mano (ver simbolosDiagrama.jsx) tras
// investigar fuentes externas y no encontrar ninguna que cubriera el
// catálogo completo con licencia y estilo consistentes — decisión
// explícita del usuario: "Dibujalo tu mismo".
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

const ANCHO_NODO = 120;
const ALTO_NODO = 68;
const TAMANO_SIMBOLO = 30;

const COLOR_POR_CATEGORIA = {
  fuente: colores.ok,
  medicion_proteccion: colores.warn,
  distribucion: colores.copper,
  control: colores.copperDim,
  carga: colores.textDim,
};

function colorDeNodo(tipo) {
  const comp = App.diagrama.obtenerComponente(tipo);
  return COLOR_POR_CATEGORIA[comp?.categoria] ?? colores.border;
}

export default function DiagramaUnifilar({
  nodosDiagrama,
  crearNodoDiagrama,
  editarNodoDiagrama,
  eliminarNodoDiagrama,
  conexionesDiagrama,
  crearConexionDiagrama,
  eliminarConexionDiagrama,
  tableros = [],
  equipos = [],
  circuitos = [],
  fuentesEnergia = [],
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

  const entidadesPorRef = { tableros, equipos, fuentesEnergia };

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

  /** Nombre a mostrar en el nodo: el de la entidad vinculada (vivo), o el propio del nodo si no tiene vínculo. */
  function nombreMostrado(nodo) {
    const entidad = App.diagrama.resolverEntidad(nodo, entidadesPorRef);
    return entidad?.nombre?.trim() || nodo.nombre;
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

  function coordenadasSvg(e) {
    const rect = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function posicionDe(nodo) {
    return posicionesArrastre[nodo.id] ?? nodo.posicion;
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
    if (!arrastre) return;
    const pos = coordenadasSvg(e);
    setPosicionesArrastre((prev) => ({
      ...prev,
      [arrastre.nodoId]: { x: Math.max(0, pos.x - arrastre.offsetX), y: Math.max(0, pos.y - arrastre.offsetY) },
    }));
  }

  function alMouseUpSvg() {
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
        color: modo === valor ? "#171512" : colores.textDim,
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
              .candidatosEntidad(tipoSeleccionado, { tableros, equipos, fuentesEnergia, nodos: nodosDiagrama })
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
          style={{ padding: "6px 10px", borderRadius: 3, border: "none", background: colores.copper, color: "#171512", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
        >
          + Agregar
        </button>

        <div style={{ flex: 1 }} />

        {botonModo("mover", "Mover")}
        {botonModo("conectar", "Conectar")}
        {botonModo("vincular", "Vincular")}
        {botonModo("eliminar", "Eliminar")}
      </div>

      <div style={{ fontSize: 11, color: colores.textDim, marginBottom: 6 }}>
        {modo === "mover" && "Arrastrá un nodo para reposicionarlo."}
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
                style={{ padding: "5px 10px", borderRadius: 3, border: "none", background: colores.copper, color: "#171512", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}
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
        <div style={{ fontSize: 11.5, color: colores.error, background: `${colores.error}14`, border: `1px solid ${colores.error}44`, borderRadius: 3, padding: "6px 8px", marginBottom: 8 }}>
          ⚠ {aviso}
        </div>
      )}

      <svg
        ref={svgRef}
        width="100%"
        height={420}
        style={{ background: colores.bg, border: `1px solid ${colores.border}`, borderRadius: 4, display: "block" }}
        onMouseMove={alMouseMoveSvg}
        onMouseUp={alMouseUpSvg}
        onMouseLeave={alMouseUpSvg}
      >
        <defs>
          <marker id="flecha-diagrama" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill={colores.textDim} />
          </marker>
        </defs>

        {conexionesDiagrama.map((cx) => {
          const origen = nodosDiagrama.find((n) => n.id === cx.nodoOrigenId);
          const destino = nodosDiagrama.find((n) => n.id === cx.nodoDestinoId);
          if (!origen || !destino) return null; // referencia rota — no debería pasar, pero no explota
          const p1 = posicionDe(origen);
          const p2 = posicionDe(destino);
          const x1 = p1.x + ANCHO_NODO / 2;
          const y1 = p1.y + ALTO_NODO;
          const x2 = p2.x + ANCHO_NODO / 2;
          const y2 = p2.y;
          return (
            <line
              key={cx.id}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={colores.textDim}
              strokeWidth={1.5}
              markerEnd="url(#flecha-diagrama)"
              onClick={() => modo === "eliminar" && eliminarConexionDiagrama(cx.id)}
              style={{ cursor: modo === "eliminar" ? "pointer" : "default" }}
            />
          );
        })}

        {nodosDiagrama.map((nodo) => {
          const pos = posicionDe(nodo);
          const comp = App.diagrama.obtenerComponente(nodo.tipo);
          const seleccionado = origenPendiente === nodo.id || nodoVinculando === nodo.id;
          const entidad = App.diagrama.resolverEntidad(nodo, entidadesPorRef);
          const nombre = nombreMostrado(nodo);
          return (
            <g
              key={nodo.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              onMouseDown={(e) => alMouseDownNodo(e, nodo)}
              style={{ cursor: modo === "mover" ? "grab" : "pointer" }}
            >
              <rect
                width={ANCHO_NODO}
                height={ALTO_NODO}
                rx={4}
                fill={colores.panel}
                stroke={seleccionado ? colores.copper : colorDeNodo(nodo.tipo)}
                strokeWidth={seleccionado ? 3 : 1.5}
              />
              <SimboloDiagrama
                tipo={nodo.tipo}
                x={(ANCHO_NODO - TAMANO_SIMBOLO) / 2}
                y={4}
                size={TAMANO_SIMBOLO}
                color={seleccionado ? colores.copper : colorDeNodo(nodo.tipo)}
              />
              <text x={ANCHO_NODO / 2} y={48} textAnchor="middle" fontSize={11} fontFamily={fuentes.display} fill={colores.textMain}>
                {nombre.length > 16 ? `${nombre.slice(0, 15)}…` : nombre}
              </text>
              <text x={ANCHO_NODO / 2} y={60} textAnchor="middle" fontSize={8.5} fontFamily={fuentes.mono} fill={entidad ? colores.ok : colores.textDim}>
                {entidad ? `${comp?.nombre ?? nodo.tipo} · vinculado` : comp?.nombre ?? nodo.tipo}
              </text>
            </g>
          );
        })}
      </svg>

      <div style={{ fontSize: 10.5, color: colores.textDim, lineHeight: 1.4, marginTop: 8 }}>
        Prototipo sin cálculos todavía — solo registra la topología (qué se conecta con qué). El posicionamiento es
        manual; la autoorganización automática queda para más adelante.
      </div>
    </div>
  );
}
