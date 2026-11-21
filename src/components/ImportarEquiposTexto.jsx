import React, { useState } from "react";
import { colores, fuentes } from "../styles/colores";

// Importación de equipos por texto — pedido explícito del usuario
// (2026-11-20), tras discutir (y descartar junto con él) un chatbot
// con IA real para esto: un formulario chico y determinístico da el
// mismo resultado sin mandar nada a ningún servidor ni la ambigüedad
// de interpretar texto libre. Ver ImportacionMediator /
// modules/importacionEquipos/index.js para el porqué completo.
//
// Alcance acotado A PROPÓSITO: esto SOLO crea equipos, nunca
// tableros/circuitos — deben existir de antes, referenciados por su
// etiqueta (mismo sistema de etiquetado ya construido). Nunca se
// inventa un dato que el texto no haya dado.
//
// Plegado por defecto (no estorba a quien no lo usa) — mismo patrón
// que otros paneles opcionales de la app.
const EJEMPLO_PLACEHOLDER = `TD1-C3
5 Bombillo 40W
35 Bombillo 20W

TD1-C4
1 Refrigerador 1200W`;

export default function ImportarEquiposTexto({ onPrevisualizar, onConfirmar }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [filas, setFilas] = useState(null); // null = todavía no se previsualizó
  const [aviso, setAviso] = useState("");

  const validas = filas?.filter((f) => f.ok) ?? [];
  const invalidas = filas?.filter((f) => !f.ok) ?? [];

  function previsualizar() {
    setFilas(onPrevisualizar(texto));
    setAviso("");
  }

  function importar() {
    const cantidad = onConfirmar(filas);
    setAviso(`${cantidad} equipo${cantidad === 1 ? "" : "s"} importado${cantidad === 1 ? "" : "s"}.`);
    setTexto("");
    setFilas(null);
    setTimeout(() => setAviso(""), 5000);
  }

  return (
    <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: abierto ? 18 : "10px 18px" }}>
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        style={{ background: "none", border: "none", color: colores.copper, fontWeight: 700, fontSize: 12.5, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 6 }}
      >
        <span style={{ fontSize: 10 }}>{abierto ? "▾" : "▸"}</span>
        ¿Preferís pegar una lista? Importar equipos por texto
      </button>

      {abierto && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11.5, color: colores.textDim, lineHeight: 1.5, marginBottom: 10 }}>
            Una línea con la etiqueta de un circuito YA CREADO (ej. "TD1-C3"), seguida de una línea por equipo:
            "cantidad nombre valorW" (o "valorA" para corriente). Nunca crea tableros ni circuitos nuevos — si la
            etiqueta no existe todavía, creala primero arriba.
          </div>
          <textarea
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setFilas(null);
            }}
            placeholder={EJEMPLO_PLACEHOLDER}
            rows={7}
            style={{
              width: "100%",
              padding: "8px 10px",
              background: colores.bg,
              border: `1px solid ${colores.border}`,
              borderRadius: 3,
              color: colores.textMain,
              fontSize: 12.5,
              fontFamily: fuentes.mono,
              boxSizing: "border-box",
              resize: "vertical",
            }}
          />

          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={previsualizar}
              disabled={!texto.trim()}
              style={{
                padding: "7px 14px",
                borderRadius: 3,
                border: "none",
                background: texto.trim() ? colores.copper : colores.border,
                color: texto.trim() ? colores.textSobreAcento : colores.textDim,
                fontWeight: 700,
                fontSize: 12,
                cursor: texto.trim() ? "pointer" : "not-allowed",
              }}
            >
              Previsualizar
            </button>

            {filas && validas.length > 0 && (
              <button
                type="button"
                onClick={importar}
                style={{ padding: "7px 14px", borderRadius: 3, border: "none", background: colores.ok, color: "#171512", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
              >
                Importar {validas.length} equipo{validas.length === 1 ? "" : "s"}
              </button>
            )}
          </div>

          {aviso && (
            <div style={{ fontSize: 12, color: colores.ok, marginTop: 10 }}>{aviso}</div>
          )}

          {filas && filas.length === 0 && (
            <div style={{ fontSize: 12, color: colores.textDim, marginTop: 10 }}>No se encontró ninguna línea de equipo para interpretar.</div>
          )}

          {filas && filas.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              {filas.map((f, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "baseline",
                    fontSize: 11.5,
                    padding: "4px 8px",
                    borderRadius: 3,
                    background: f.ok ? colores.okFondo : colores.errorFondo,
                    border: `1px solid ${f.ok ? colores.ok : colores.error}44`,
                  }}
                >
                  <span style={{ color: colores.textDim, fontFamily: fuentes.mono, flex: "0 0 auto" }}>L{f.numeroLinea}</span>
                  {f.ok ? (
                    <span style={{ color: colores.textMain }}>
                      ✓ {f.equipo.cantidad}× {f.nombre} — {f.equipo.valor}{f.equipo.modoEntrada === "corriente" ? "A" : "W"} → {f.etiquetaCircuito} ({f.nombreCircuito})
                    </span>
                  ) : (
                    <span style={{ color: colores.error }}>✗ {f.motivo}</span>
                  )}
                </div>
              ))}
              {invalidas.length > 0 && (
                <div style={{ fontSize: 11, color: colores.warn, marginTop: 4 }}>
                  {invalidas.length} línea{invalidas.length === 1 ? "" : "s"} con error — no se van a importar, el resto sí.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
