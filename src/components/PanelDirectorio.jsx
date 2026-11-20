import React, { useMemo, useState } from "react";
import { colores, fuentes } from "../styles/colores";
import { inputStyle } from "./Campo";
import { ApplicationMediator as App } from "../core/ApplicationMediator.js";

// "Directorio" — pestaña dedicada al sistema de etiquetado. Arrancó
// como una tabla de SOLO LECTURA (2026-11-20). Siguiente ronda, pedido
// explícito del usuario: convertirla en un "menú plegable" para editar
// de forma más simple tanto el Diagrama unifilar como el Plano (y de
// paso, tableros/circuitos/equipos) SIN tener que ir a buscarlos a su
// propia pestaña — un panel de capas (como el de un editor de diseño),
// no una pestaña más con su propio editor paralelo.
//
// Los campos que se editan acá son SIEMPRE de presentación (nombre/
// etiqueta/función, o el nombre de un nodo/marcador) — nunca datos
// eléctricos (potencia, fases, etc.), que siguen viviendo solo en el
// formulario completo con su validación (pestañas Tableros / Circuitos
// y resultados). Por eso circuito/equipo usan acá
// editarEtiquetaFuncionCircuito/Equipo (patch liviano de 3 campos nada
// más, ver la nota en useCircuitos.js) en vez de guardarCircuito/
// guardarEquipo. Eliminar acá es la MISMA función que ya usa cada
// pestaña propia (mismas cascadas de limpieza, ningún comportamiento
// nuevo) — Directorio es otra puerta de entrada al mismo estado, no
// una copia de la lógica.

function coincide(obj, campos, q) {
  if (!q) return true;
  return campos.some((c) => (obj?.[c] || "").toLowerCase().includes(q));
}

/** Fila plegable genérica: flecha + header (lo que se vea, editable o no) + contenido que se desmonta al cerrar. */
function Plegable({ nivel = 0, abierto, onToggle, header, children, vacio }) {
  return (
    <div style={{ marginLeft: nivel * 14, marginBottom: nivel === 0 ? 10 : 5 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: nivel === 0 ? "7px 8px" : "5px 6px",
          background: nivel === 0 ? colores.bg : "transparent",
          border: `1px solid ${nivel === 0 ? colores.border : "transparent"}`,
          borderRadius: 3,
        }}
      >
        <button
          type="button"
          onClick={onToggle}
          style={{ background: "none", border: "none", color: colores.copper, cursor: "pointer", fontSize: 10, padding: 0, flex: "0 0 auto", width: 12 }}
          aria-label={abierto ? "Plegar" : "Desplegar"}
        >
          {abierto ? "▾" : "▸"}
        </button>
        {header}
      </div>
      {abierto && <div style={{ marginTop: 4 }}>{children ?? vacio}</div>}
    </div>
  );
}

function campoInline(valor, onChange, placeholder, flex = 1) {
  return (
    <input
      style={{ ...inputStyle(), flex, padding: "4px 6px", fontSize: 11.5, width: "auto" }}
      value={valor}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function botonEliminar(onClick, etiquetaAria, title) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{ background: "none", border: "none", color: colores.textDim, cursor: "pointer", fontSize: 15, flex: "0 0 auto", padding: "0 2px", lineHeight: 1 }}
      aria-label={`Eliminar ${etiquetaAria}`}
    >
      ×
    </button>
  );
}

function filaVacia(texto) {
  return <div style={{ fontSize: 11.5, color: colores.textDim, padding: "4px 8px", fontStyle: "italic" }}>{texto}</div>;
}

function etiquetaSeccion(titulo, contador) {
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color: colores.textMain }}>
      {titulo} <span style={{ color: colores.textDim, fontWeight: 400 }}>({contador})</span>
    </span>
  );
}

export default function PanelDirectorio({
  tableros,
  editarTablero,
  eliminarTablero,
  circuitos,
  editarEtiquetaFuncionCircuito,
  eliminarCircuito,
  equipos,
  editarEtiquetaFuncionEquipo,
  eliminarEquipo,
  nodosDiagrama,
  editarNodoDiagrama,
  eliminarNodoDiagrama,
  habitacionesPlano,
  renombrarHabitacionPlano,
  eliminarHabitacionPlano,
  rutasConductorPlano,
  renombrarRutaConductorPlano,
  eliminarRutaConductorPlano,
  marcadoresEquipoPlano,
  editarMarcadorEquipoPlano,
  eliminarMarcadorEquipoPlano,
  fuentesEnergia = [],
  transformadores = [],
}) {
  const [busqueda, setBusqueda] = useState("");
  const q = busqueda.trim().toLowerCase();

  // Plegado — por defecto TODO abierto (mejor ver qué hay que adivinar
  // que algo está escondido). Un Set de ids CERRADOS, así un
  // tablero/circuito nuevo nace abierto sin tener que sembrar estado.
  const [cerrados, setCerrados] = useState(() => new Set());
  function alternar(id) {
    setCerrados((actual) => {
      const copia = new Set(actual);
      if (copia.has(id)) copia.delete(id);
      else copia.add(id);
      return copia;
    });
  }
  // Con una búsqueda activa, todo se fuerza ABIERTO — si no, un
  // resultado podría quedar escondido adentro de algo plegado y
  // parecer que "no hay nada".
  const abierto = (id) => (q ? true : !cerrados.has(id));

  const circuitosSinTablero = useMemo(
    () => circuitos.filter((c) => !tableros.some((t) => t.id === c.tableroId)),
    [circuitos, tableros]
  );

  function etiquetaEntidadEquipoPlano(tipoEquipo, entidad) {
    const comp = App.plano.obtenerComponente(tipoEquipo);
    if (comp?.entidadVinculada === "equipo") {
      const circuito = circuitos.find((c) => c.id === entidad.circuitoId);
      const tablero = circuito ? tableros.find((t) => t.id === circuito.tableroId) : null;
      const contexto = [circuito?.nombre, tablero?.nombre].filter(Boolean).join(" · ");
      return contexto ? `${entidad.nombre || "Equipo sin nombre"} (${contexto})` : entidad.nombre || "Equipo sin nombre";
    }
    return entidad.nombre || "(sin nombre)";
  }

  function filaEquipo(e) {
    return (
      <div key={e.id} style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: 28, marginBottom: 4 }}>
        {campoInline(e.etiqueta || "", (v) => editarEtiquetaFuncionEquipo(e.id, { etiqueta: v }), "Etiqueta", "0 0 90px")}
        {campoInline(e.nombre || "", (v) => editarEtiquetaFuncionEquipo(e.id, { nombre: v }), "Nombre del equipo")}
        {campoInline(e.funcion || "", (v) => editarEtiquetaFuncionEquipo(e.id, { funcion: v }), "Función (opcional)")}
        {botonEliminar(() => eliminarEquipo(e.id), e.nombre || "equipo", "Eliminar equipo")}
      </div>
    );
  }

  function filaCircuito(c) {
    const equiposDelCircuito = equipos.filter((e) => e.circuitoId === c.id);
    const equiposVisibles = equiposDelCircuito.filter((e) => coincide(e, ["etiqueta", "nombre", "funcion"], q));
    if (q && !coincide(c, ["etiqueta", "nombre", "funcion"], q) && equiposVisibles.length === 0) return null;
    const header = (
      <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1 }}>
        {campoInline(c.etiqueta || "", (v) => editarEtiquetaFuncionCircuito(c.id, { etiqueta: v }), "Etiqueta", "0 0 90px")}
        {campoInline(c.nombre || "", (v) => editarEtiquetaFuncionCircuito(c.id, { nombre: v }), "Nombre del circuito")}
        {campoInline(c.funcion || "", (v) => editarEtiquetaFuncionCircuito(c.id, { funcion: v }), "Función (opcional)")}
        {botonEliminar(() => eliminarCircuito(c.id), c.nombre || "circuito", "Eliminar circuito (sus equipos se eliminan con él)")}
      </div>
    );
    const listaEquipos = q ? equiposVisibles : equiposDelCircuito;
    return (
      <Plegable key={c.id} nivel={2} abierto={abierto(c.id)} onToggle={() => alternar(c.id)} header={header} vacio={filaVacia("Sin equipos en este circuito.")}>
        {listaEquipos.length === 0 ? null : listaEquipos.map(filaEquipo)}
      </Plegable>
    );
  }

  function filaTablero(t) {
    const circuitosDelTablero = circuitos.filter((c) => c.tableroId === t.id);
    const propioCoincide = coincide(t, ["etiqueta", "nombre", "funcion"], q);
    const descendienteCoincide = circuitosDelTablero.some(
      (c) => coincide(c, ["etiqueta", "nombre", "funcion"], q) || equipos.some((e) => e.circuitoId === c.id && coincide(e, ["etiqueta", "nombre", "funcion"], q))
    );
    if (q && !propioCoincide && !descendienteCoincide) return null;
    const header = (
      <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1 }}>
        {campoInline(t.etiqueta || "", (v) => editarTablero(t.id, { etiqueta: v }), "Etiqueta", "0 0 90px")}
        {campoInline(t.nombre || "", (v) => editarTablero(t.id, { nombre: v }), "Nombre del tablero")}
        {campoInline(t.funcion || "", (v) => editarTablero(t.id, { funcion: v }), "Función (opcional)")}
        {botonEliminar(() => eliminarTablero(t.id), t.nombre || "tablero", "Eliminar tablero (sus circuitos quedan sin asignar, no se borran)")}
      </div>
    );
    return (
      <Plegable key={t.id} nivel={1} abierto={abierto(t.id)} onToggle={() => alternar(t.id)} header={header} vacio={filaVacia("Sin circuitos en este tablero.")}>
        {circuitosDelTablero.map(filaCircuito)}
      </Plegable>
    );
  }

  function filaNodoDiagrama(n) {
    if (q && !coincide(n, ["nombre"], q)) return null;
    const comp = App.diagrama.obtenerComponente(n.tipo);
    const entidad = App.diagrama.resolverEntidad(n, { tableros, equipos, fuentesEnergia, transformadores });
    return (
      <div key={n.id} style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: 14, marginBottom: 4 }}>
        <span style={{ fontSize: 10.5, color: colores.textDim, flex: "0 0 150px", fontFamily: fuentes.condensada, textTransform: "uppercase", letterSpacing: "0.03em" }}>
          {comp?.nombre ?? n.tipo}
        </span>
        {campoInline(n.nombre || "", (v) => editarNodoDiagrama(n.id, { nombre: v }), "Nombre del nodo")}
        <span style={{ fontSize: 11, color: entidad ? colores.ok : colores.textDim, flex: "0 0 160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {entidad ? `↳ ${entidad.nombre || "(sin nombre)"}` : "sin vincular"}
        </span>
        {botonEliminar(() => eliminarNodoDiagrama(n.id), n.nombre || "nodo", "Eliminar nodo del diagrama")}
      </div>
    );
  }

  function filaHabitacion(h) {
    if (q && !coincide(h, ["nombre"], q)) return null;
    return (
      <div key={h.id} style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: 14, marginBottom: 4 }}>
        {campoInline(h.nombre, (v) => renombrarHabitacionPlano(h.id, v), "Nombre del ambiente")}
        <span style={{ fontSize: 11, color: colores.textDim, fontFamily: fuentes.mono, flex: "0 0 auto", whiteSpace: "nowrap" }}>
          {h.areaM2.toFixed(2)} m²
        </span>
        {botonEliminar(() => eliminarHabitacionPlano(h.id), h.nombre, "Eliminar ambiente")}
      </div>
    );
  }

  function filaRutaConductor(r) {
    if (q && !coincide(r, ["nombre"], q)) return null;
    return (
      <div key={r.id} style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: 14, marginBottom: 4 }}>
        {campoInline(r.nombre, (v) => renombrarRutaConductorPlano(r.id, v), "Nombre de la ruta")}
        <span style={{ fontSize: 11, color: colores.textDim, fontFamily: fuentes.mono, flex: "0 0 auto", whiteSpace: "nowrap" }}>
          {r.longitudM.toFixed(2)} m
        </span>
        {botonEliminar(() => eliminarRutaConductorPlano(r.id), r.nombre, "Eliminar ruta de conductor")}
      </div>
    );
  }

  function filaMarcadorEquipo(m) {
    if (q && !coincide(m, ["nombre"], q)) return null;
    const comp = App.plano.obtenerComponente(m.tipo);
    const entidad = App.plano.resolverEntidadEquipo(m, { tableros, equipos, fuentesEnergia, transformadores });
    const candidatos = App.plano.candidatosEntidadEquipo(m.tipo, { tableros, equipos, fuentesEnergia, transformadores, marcadores: marcadoresEquipoPlano, marcadorId: m.id });
    return (
      <div key={m.id} style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: 14, marginBottom: 4, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10.5, color: colores.textDim, flex: "0 0 150px", fontFamily: fuentes.condensada, textTransform: "uppercase", letterSpacing: "0.03em" }}>
          {comp?.nombre ?? m.tipo}
        </span>
        {campoInline(m.nombre || "", (v) => editarMarcadorEquipoPlano(m.id, { nombre: v }), "Nombre (opcional)")}
        {comp?.entidadVinculada && (
          <select
            value={m.entidadId ?? ""}
            onChange={(e) => editarMarcadorEquipoPlano(m.id, { entidadId: e.target.value || null })}
            style={{ padding: "4px 6px", borderRadius: 3, border: `1px solid ${colores.border}`, background: colores.bg, color: colores.textMain, fontSize: 11, flex: "0 0 180px" }}
          >
            <option value="">— Sin vincular —</option>
            {entidad && !candidatos.some((c) => c.id === entidad.id) && (
              <option value={entidad.id}>{etiquetaEntidadEquipoPlano(m.tipo, entidad)}</option>
            )}
            {candidatos.map((c) => (
              <option key={c.id} value={c.id}>
                {etiquetaEntidadEquipoPlano(m.tipo, c)}
              </option>
            ))}
          </select>
        )}
        {botonEliminar(() => eliminarMarcadorEquipoPlano(m.id), m.nombre || "equipo del plano", "Eliminar marcador del plano")}
      </div>
    );
  }

  const nodosVisibles = nodosDiagrama.filter((n) => !q || coincide(n, ["nombre"], q));
  const habitacionesVisibles = habitacionesPlano.filter((h) => !q || coincide(h, ["nombre"], q));
  const rutasVisibles = rutasConductorPlano.filter((r) => !q || coincide(r, ["nombre"], q));
  const marcadoresVisibles = marcadoresEquipoPlano.filter((m) => !q || coincide(m, ["nombre"], q));

  const hayAlgo =
    tableros.length || circuitos.length || equipos.length || nodosDiagrama.length || habitacionesPlano.length || rutasConductorPlano.length || marcadoresEquipoPlano.length;

  return (
    <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: 14 }}>
      <div style={{ fontSize: 11, color: colores.textDim, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
        Directorio — tableros, diagrama y plano desde un solo lugar
      </div>

      {!hayAlgo ? (
        <div style={{ fontSize: 12.5, color: colores.textDim, textAlign: "center", padding: "10px 0" }}>
          Todavía no hay nada en el proyecto.
        </div>
      ) : (
        <>
          <input
            style={{ ...inputStyle(), marginBottom: 12, padding: "7px 10px", fontSize: 12.5 }}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por etiqueta, nombre o función…"
          />

          <Plegable
            nivel={0}
            abierto={abierto("sec-tableros")}
            onToggle={() => alternar("sec-tableros")}
            header={etiquetaSeccion("Tableros, circuitos y equipos", tableros.length + circuitos.length + equipos.length)}
            vacio={filaVacia("Sin tableros ni circuitos todavía.")}
          >
            {tableros.map(filaTablero)}
            {circuitosSinTablero.length > 0 && (
              <Plegable
                nivel={1}
                abierto={abierto("sec-circuitos-sueltos")}
                onToggle={() => alternar("sec-circuitos-sueltos")}
                header={<span style={{ fontSize: 11.5, fontWeight: 600, color: colores.textDim }}>Circuitos sin tablero ({circuitosSinTablero.length})</span>}
              >
                {circuitosSinTablero.map(filaCircuito)}
              </Plegable>
            )}
          </Plegable>

          <Plegable
            nivel={0}
            abierto={abierto("sec-diagrama")}
            onToggle={() => alternar("sec-diagrama")}
            header={etiquetaSeccion("Diagrama unifilar", nodosDiagrama.length)}
            vacio={filaVacia("Sin nodos en el diagrama todavía.")}
          >
            {nodosVisibles.length === 0 && q ? filaVacia(`Nada coincide con "${busqueda}".`) : nodosVisibles.map(filaNodoDiagrama)}
          </Plegable>

          <Plegable
            nivel={0}
            abierto={abierto("sec-plano")}
            onToggle={() => alternar("sec-plano")}
            header={etiquetaSeccion("Plano", habitacionesPlano.length + rutasConductorPlano.length + marcadoresEquipoPlano.length)}
            vacio={filaVacia("Sin ambientes, rutas ni equipos marcados en el plano todavía.")}
          >
            <Plegable
              nivel={1}
              abierto={abierto("sec-plano-ambientes")}
              onToggle={() => alternar("sec-plano-ambientes")}
              header={<span style={{ fontSize: 11.5, fontWeight: 600, color: colores.textDim }}>Ambientes ({habitacionesPlano.length})</span>}
              vacio={filaVacia("Sin ambientes trazados todavía.")}
            >
              {habitacionesVisibles.length === 0 && q ? null : habitacionesVisibles.map(filaHabitacion)}
            </Plegable>
            <Plegable
              nivel={1}
              abierto={abierto("sec-plano-rutas")}
              onToggle={() => alternar("sec-plano-rutas")}
              header={<span style={{ fontSize: 11.5, fontWeight: 600, color: colores.textDim }}>Rutas de conductor ({rutasConductorPlano.length})</span>}
              vacio={filaVacia("Sin rutas de conductor trazadas todavía.")}
            >
              {rutasVisibles.length === 0 && q ? null : rutasVisibles.map(filaRutaConductor)}
            </Plegable>
            <Plegable
              nivel={1}
              abierto={abierto("sec-plano-equipos")}
              onToggle={() => alternar("sec-plano-equipos")}
              header={<span style={{ fontSize: 11.5, fontWeight: 600, color: colores.textDim }}>Equipos en el plano ({marcadoresEquipoPlano.length})</span>}
              vacio={filaVacia("Sin equipos marcados en el plano todavía.")}
            >
              {marcadoresVisibles.length === 0 && q ? null : marcadoresVisibles.map(filaMarcadorEquipo)}
            </Plegable>
          </Plegable>
        </>
      )}
    </div>
  );
}
