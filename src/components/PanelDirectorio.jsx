import React, { useMemo, useState } from "react";
import { colores, fuentes } from "../styles/colores";
import { inputStyle } from "./Campo";
import { ApplicationMediator as App } from "../core/ApplicationMediator.js";

// "Directorio" — pestaña dedicada al sistema de etiquetado, pedido
// explícito del usuario (2026-11-20): un punto único donde consultar
// la etiqueta y la función de CADA objeto del proyecto (tablero,
// circuito, equipo), sin tener que ir a buscarlo a su propia pestaña.
// Es una vista de SOLO LECTURA — la edición real de etiqueta/función
// sigue viviendo en el formulario de cada objeto (mismo criterio que
// TablaResultados, que tampoco duplica edición). Ver
// modules/etiquetado/index.js para el modelo de datos.
const TIPO_OBJETO_UI = {
  tablero: { label: "Tablero", color: colores.copper },
  circuito: { label: "Circuito", color: colores.ok },
  equipo: { label: "Equipo", color: colores.textDim },
};

function Th({ children, alinearDerecha }) {
  return (
    <th
      style={{
        textAlign: alinearDerecha ? "right" : "left",
        fontSize: 10.5,
        fontWeight: 700,
        color: colores.textDim,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        padding: "6px 10px",
        borderBottom: `1px solid ${colores.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function celda(contenido, { color } = {}) {
  return (
    <td style={{ padding: "7px 10px", fontSize: 12.5, color: color ?? colores.textMain, borderBottom: `1px solid ${colores.border}` }}>
      {contenido}
    </td>
  );
}

export default function PanelDirectorio({ tableros, circuitos, equipos }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");

  const filas = useMemo(
    () => App.etiquetado.directorio({ tableros, circuitos, equipos }),
    [tableros, circuitos, equipos]
  );

  const filasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas.filter((f) => {
      if (filtroTipo !== "todos" && f.tipoObjeto !== filtroTipo) return false;
      if (!q) return true;
      return (
        f.etiqueta.toLowerCase().includes(q) ||
        f.nombre.toLowerCase().includes(q) ||
        f.funcion.toLowerCase().includes(q) ||
        f.contexto.toLowerCase().includes(q)
      );
    });
  }, [filas, busqueda, filtroTipo]);

  return (
    <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: 14 }}>
      <div style={{ fontSize: 11, color: colores.textDim, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
        Directorio — etiquetas y función de cada objeto
      </div>

      {filas.length === 0 ? (
        <div style={{ fontSize: 12.5, color: colores.textDim, textAlign: "center", padding: "10px 0" }}>
          Todavía no hay tableros, circuitos ni equipos en el proyecto.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <input
              style={{ ...inputStyle(), flex: "1 1 220px" }}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por etiqueta, nombre o función…"
            />
            <div style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
              {[
                { valor: "todos", label: "Todos" },
                { valor: "tablero", label: "Tableros" },
                { valor: "circuito", label: "Circuitos" },
                { valor: "equipo", label: "Equipos" },
              ].map((op) => (
                <button
                  key={op.valor}
                  type="button"
                  onClick={() => setFiltroTipo(op.valor)}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 3,
                    border: `1px solid ${filtroTipo === op.valor ? colores.copper : colores.border}`,
                    background: filtroTipo === op.valor ? colores.copper : "transparent",
                    color: filtroTipo === op.valor ? "#171512" : colores.textDim,
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {op.label}
                </button>
              ))}
            </div>
          </div>

          {filasFiltradas.length === 0 ? (
            <div style={{ fontSize: 12.5, color: colores.textDim, textAlign: "center", padding: "10px 0" }}>
              Nada coincide con "{busqueda}".
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <Th>Etiqueta</Th>
                    <Th>Tipo</Th>
                    <Th>Nombre</Th>
                    <Th>Función</Th>
                    <Th>Dónde</Th>
                  </tr>
                </thead>
                <tbody>
                  {filasFiltradas.map((f) => {
                    const tipoUI = TIPO_OBJETO_UI[f.tipoObjeto];
                    return (
                      <tr key={`${f.tipoObjeto}-${f.id}`}>
                        {celda(
                          f.etiqueta || <span style={{ color: colores.textDim }}>— sin etiqueta —</span>,
                          { color: colores.textMain }
                        )}
                        <td style={{ padding: "7px 10px", fontSize: 11.5, fontWeight: 600, color: tipoUI.color, borderBottom: `1px solid ${colores.border}`, fontFamily: fuentes.condensada, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                          {tipoUI.label}
                        </td>
                        {celda(f.nombre)}
                        {celda(f.funcion || <span style={{ color: colores.textDim }}>—</span>)}
                        {celda(f.contexto || <span style={{ color: colores.textDim }}>—</span>, { color: colores.textDim })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ fontSize: 11, color: colores.textDim, marginTop: 10 }}>
            {filasFiltradas.length} de {filas.length} objeto{filas.length !== 1 ? "s" : ""}. Para editar la etiqueta o la función de uno,
            hacelo desde su propia pestaña (Tableros o Circuitos y resultados) — acá es solo para consultar.
          </div>
        </>
      )}
    </div>
  );
}
