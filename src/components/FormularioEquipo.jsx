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
        color: activo ? colores.textSobreAcento : colores.textDim,
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

      <div style={{ display: "grid", gridTemplateColumns: "0.6fr 1.4fr", gap: 10 }}>
        <Campo label="Etiqueta">
          <input style={inputStyle()} value={form.etiqueta} onChange={(e) => setForm({ ...form, etiqueta: e.target.value })} placeholder="Ej: TD1-C3-E1" />
        </Campo>
        <Campo label="Función (opcional)">
          <input style={inputStyle()} value={form.funcion} onChange={(e) => setForm({ ...form, funcion: e.target.value })} placeholder="Ej: Conserva alimentos de la cocina" />
        </Campo>
      </div>

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

      {/* Altura de instalación — usuario, 2026-11-25: "hay que tomar en
          cuenta la altura donde se instala un interruptor [o]
          tomacorriente". Opcional y puramente física: sin cargarla, cero
          cambio de comportamiento. Con ella, "Usar esta longitud" (en el
          Plano) suma la bajada/subida real hasta este equipo al metraje
          del circuito — ver modules/plano/alturaInstalacion.ts. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 10 }}>
        <Campo label="Altura instalación (m, opcional)">
          <input
            style={inputStyle()}
            type="number"
            step="0.05"
            min="0"
            value={form.alturaInstalacionM}
            onChange={(e) => setForm({ ...form, alturaInstalacionM: e.target.value })}
            placeholder="Ej: 0.4"
          />
        </Campo>
        <Campo label="Referencia">
          <div style={{ display: "flex", gap: 6 }}>
            <BotonPill activo={form.referenciaAltura !== "piso"} onClick={() => setForm({ ...form, referenciaAltura: "techo" })}>
              Desde el techo
            </BotonPill>
            <BotonPill activo={form.referenciaAltura === "piso"} onClick={() => setForm({ ...form, referenciaAltura: "piso" })}>
              Desde el piso
            </BotonPill>
          </div>
        </Campo>
      </div>

      {/* GFCI — usuario, 2026-11-25/26: "el tipo de tomacorriente...
          y el ambiente donde se localiza". Documental: dispara una
          advertencia (NEC 210.8(A)/(B)) si este equipo cae en un
          ambiente del Plano donde se exige GFCI y no está marcado acá
          — ver modules/plano/proteccionGFCI.ts. */}
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: colores.textMain, marginBottom: 14, cursor: "pointer" }}>
        <input type="checkbox" checked={!!form.proteccionGFCI} onChange={(e) => setForm({ ...form, proteccionGFCI: e.target.checked })} />
        Protegido por GFCI
      </label>

      {/* esCargaContinua — auditoría 2026-11-26: el dato YA existía de
          punta a punta (tipos.ts/plantillas.js/formularios.ts/
          factorDemanda.ts × 1.25 Art. 210.19) pero sin ningún checkbox
          que lo editara — inalcanzable desde la UI, siempre quedaba en
          false. Vive en el EQUIPO (no en el circuito, a diferencia del
          checkbox fantasma "Carga continua" que SÍ vivía en
          FormularioCircuito.jsx sin persistirse nunca — se quitó de ahí
          en esta misma auditoría). */}
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: colores.textMain, marginBottom: 14, cursor: "pointer" }}>
        <input type="checkbox" checked={!!form.esCargaContinua} onChange={(e) => setForm({ ...form, esCargaContinua: e.target.checked })} />
        Carga continua (&gt;3 horas, ×1.25 — Art. 210.19)
      </label>

      {error && <div style={{ color: colores.error, fontSize: 12, marginBottom: 10 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onGuardar}
          style={{ flex: 1, padding: "10px 0", background: colores.copper, color: colores.textSobreAcento, border: "none", borderRadius: 3, fontWeight: 700, fontSize: 14, cursor: "pointer" }}
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
