import React from "react";
import Campo, { inputStyle } from "./Campo";
import { colores, fuentes } from "../styles/colores";

function BotonPill({ activo, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "8px 0",
        borderRadius: 3,
        border: `1px solid ${activo ? colores.copper : colores.border}`,
        background: activo ? colores.copper : "transparent",
        color: activo ? "#171512" : colores.textDim,
        fontWeight: 600,
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

// Un Equipo vive DENTRO de un circuito ya creado. Ya no tiene voltaje,
// fases, material ni distancia — esos son del circuito. Solo lo que le
// es propio: nombre, cantidad, consumo, y su propio cos φ.
export default function FormularioEquipo({ form, setForm, onGuardar, onCancelar, error, editando, circuitoActivo }) {
  if (!circuitoActivo) {
    return (
      <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: 18, color: colores.textDim, fontSize: 13 }}>
        Crea o selecciona un circuito arriba para poder agregarle equipos.
      </div>
    );
  }

  return (
    <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: 18 }}>
      <h2
        style={{
          fontFamily: fuentes.condensada,
          fontWeight: 600,
          fontSize: 13,
          letterSpacing: "0.08em",
          color: colores.textDim,
          margin: "0 0 4px 0",
          textTransform: "uppercase",
        }}
      >
        {editando ? "Editar equipo" : "Agregar equipo"}
      </h2>
      <div style={{ fontSize: 12, color: colores.copper, marginBottom: 14 }}>en: {circuitoActivo.nombre || "(sin nombre)"}</div>

      <Campo label="Nombre">
        <input style={inputStyle()} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Refrigerador" />
      </Campo>

      <Campo label="Dato disponible en ficha técnica">
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { valor: "potencia", label: "Potencia (W)" },
            { valor: "corriente", label: "Corriente (A)" },
          ].map((op) => (
            <BotonPill key={op.valor} activo={form.modoEntrada === op.valor} onClick={() => setForm({ ...form, modoEntrada: op.valor })}>
              {op.label}
            </BotonPill>
          ))}
        </div>
      </Campo>

      <div style={{ display: "grid", gridTemplateColumns: "0.7fr 1fr 1fr", gap: 10 }}>
        <Campo label="Cant.">
          <input style={inputStyle()} type="number" min="1" step="1" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
        </Campo>
        <Campo label={form.modoEntrada === "corriente" ? "I unitaria (A)" : "P unitaria (W)"}>
          <input style={inputStyle()} type="number" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
        </Campo>
        <Campo label="cos φ">
          <input style={inputStyle()} type="number" step="0.05" min="0.5" max="1" value={form.cosPhi} onChange={(e) => setForm({ ...form, cosPhi: e.target.value })} />
        </Campo>
      </div>

      {error && <div style={{ color: colores.error, fontSize: 12, marginBottom: 10 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onGuardar}
          style={{ flex: 1, padding: "10px 0", background: colores.copper, color: "#171512", border: "none", borderRadius: 3, fontWeight: 700, fontSize: 14, cursor: "pointer" }}
        >
          {editando ? "Guardar cambios" : "+ Agregar equipo"}
        </button>
        {editando && (
          <button onClick={onCancelar} style={{ padding: "10px 16px", background: "transparent", color: colores.textDim, border: `1px solid ${colores.border}`, borderRadius: 3, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
