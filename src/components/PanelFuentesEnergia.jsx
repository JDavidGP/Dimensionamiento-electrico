import React, { useState } from "react";
import { colores, fuentes } from "../styles/colores";
import Campo, { inputStyle } from "./Campo";
import { TIPOS_FUENTE_UI, ROLES_FUENTE_UI, BotonPill } from "./PanelTableros";

// Lista propia de fuentes de energía (Batería/Generador), con su CRUD
// completo — antes solo se podían CREAR desde un mini-formulario
// inline dentro del selector "Origen" de un tablero (que sigue
// existiendo, es un atajo útil); para EDITARLAS o ELIMINARLAS no había
// ninguna pantalla (editarFuenteEnergia/eliminarFuenteEnergia ya
// existían en el hook, pero nunca estuvieron conectadas a la UI).
//
// Pedido explícito del usuario (2026-11-19, al agregar el caso inverso
// de la sincronización diagrama↔tabla para fuentesEnergia): tarjetas
// propias, mismo patrón que las de tablero en PanelTableros.jsx
// (acordeón: fila colapsada con un punto de color por integridad,
// click para expandir y ver detalle + editar/eliminar).
const FORM_VACIO = { nombre: "", tipo: "bateria", rol: "auxiliar", capacidadKW: "", notas: "" };

function colorEstadoDe(entrada) {
  if (!entrada) return colores.ok;
  if (entrada.estado === "error") return colores.error;
  if (entrada.estado === "advertencia") return colores.warn;
  return colores.ok;
}

export default function PanelFuentesEnergia({ fuentesEnergia = [], crearFuenteEnergia, editarFuenteEnergia, eliminarFuenteEnergia, listaIntegridad = [] }) {
  const [activaId, setActivaId] = useState(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);

  function abrirCreacion() {
    setForm(FORM_VACIO);
    setEditandoId(null);
    setFormAbierto(true);
  }

  function abrirEdicion(f) {
    setForm({
      nombre: f.nombre,
      tipo: f.tipo,
      rol: f.rol,
      capacidadKW: f.capacidadKW === "" || f.capacidadKW == null ? "" : String(f.capacidadKW),
      notas: f.notas || "",
    });
    setEditandoId(f.id);
    setFormAbierto(true);
  }

  function cerrarForm() {
    setForm(FORM_VACIO);
    setEditandoId(null);
    setFormAbierto(false);
  }

  function alGuardar(e) {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    if (editandoId) {
      editarFuenteEnergia(editandoId, form);
    } else {
      const f = crearFuenteEnergia(form);
      setActivaId(f.id);
    }
    cerrarForm();
  }

  function alEliminar(f) {
    eliminarFuenteEnergia(f.id);
    if (activaId === f.id) setActivaId(null);
    if (editandoId === f.id) cerrarForm();
  }

  return (
    <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: colores.textDim, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Fuentes de energía
        </div>
        {!formAbierto && (
          <button
            onClick={abrirCreacion}
            style={{ padding: "4px 10px", borderRadius: 3, border: "none", background: colores.copper, color: "#171512", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}
          >
            + Nueva fuente
          </button>
        )}
      </div>

      {formAbierto && (
        <form onSubmit={alGuardar} style={{ border: `1px solid ${colores.border}`, borderRadius: 4, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: colores.copper, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {editandoId ? "Editar fuente de energía" : "Nueva fuente de energía"}
          </div>

          <Campo label="Nombre">
            <input
              style={inputStyle()}
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: Banco de baterías solar, Generador diesel 10kW"
            />
          </Campo>

          <Campo label="Tipo">
            <div style={{ display: "flex", gap: 6 }}>
              {TIPOS_FUENTE_UI.map((t) => (
                <BotonPill key={t.valor} activo={form.tipo === t.valor} onClick={() => setForm({ ...form, tipo: t.valor })}>
                  {t.label}
                </BotonPill>
              ))}
            </div>
          </Campo>

          <Campo label="Rol">
            <div style={{ display: "flex", gap: 6 }}>
              {ROLES_FUENTE_UI.map((r) => (
                <BotonPill key={r.valor} activo={form.rol === r.valor} onClick={() => setForm({ ...form, rol: r.valor })}>
                  {r.label}
                </BotonPill>
              ))}
            </div>
          </Campo>

          <Campo label="Capacidad (kW, opcional)">
            <input
              type="number"
              style={inputStyle()}
              value={form.capacidadKW}
              onChange={(e) => setForm({ ...form, capacidadKW: e.target.value })}
              placeholder="Ej: 10"
            />
          </Campo>

          <Campo label="Notas (opcional)">
            <input
              style={inputStyle()}
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              placeholder="Notas (opcional)"
            />
          </Campo>

          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="submit"
              disabled={!form.nombre.trim()}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 3,
                border: "none",
                background: form.nombre.trim() ? colores.copper : colores.border,
                color: form.nombre.trim() ? "#171512" : colores.textDim,
                fontWeight: 700,
                fontSize: 12.5,
                cursor: form.nombre.trim() ? "pointer" : "not-allowed",
              }}
            >
              {editandoId ? "Guardar cambios" : "+ Crear fuente"}
            </button>
            <button
              type="button"
              onClick={cerrarForm}
              style={{ padding: "8px 14px", background: "transparent", color: colores.textDim, border: `1px solid ${colores.border}`, borderRadius: 3, fontSize: 12.5, cursor: "pointer" }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {fuentesEnergia.length === 0 && !formAbierto && (
        <div style={{ fontSize: 12, color: colores.textDim }}>
          Sin fuentes de energía todavía — "+ Nueva fuente" acá, o desde el selector "Origen" al crear/editar un tablero.
        </div>
      )}

      {fuentesEnergia.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {fuentesEnergia.map((f) => {
            const activa = activaId === f.id;
            const entradaIntegridad = listaIntegridad.find((e) => e.tipo === "fuenteEnergia" && e.id === f.id);
            const colorEstado = colorEstadoDe(entradaIntegridad);
            const tipoLabel = TIPOS_FUENTE_UI.find((t) => t.valor === f.tipo)?.label ?? f.tipo;
            const rolLabel = ROLES_FUENTE_UI.find((r) => r.valor === f.rol)?.label ?? f.rol;
            return (
              <div key={f.id} style={{ border: `1px solid ${activa ? colores.copper : colores.border}`, borderRadius: 4, overflow: "hidden" }}>
                <div
                  onClick={() => setActivaId(activa ? null : f.id)}
                  style={{
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: "pointer",
                    background: activa ? `${colores.copper}14` : "transparent",
                  }}
                >
                  <span style={{ color: colores.textDim, fontSize: 11, width: 12, textAlign: "center" }}>{activa ? "▾" : "▸"}</span>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: colorEstado, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: colores.textMain }}>{f.nombre}</div>
                    <div style={{ fontFamily: fuentes.mono, fontSize: 11, color: colores.textDim }}>
                      {tipoLabel} · {rolLabel}
                      {f.capacidadKW !== "" && f.capacidadKW != null ? ` · ${f.capacidadKW} kW` : ""}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirEdicion(f);
                    }}
                    style={{ background: "none", border: "none", color: colores.textDim, cursor: "pointer", fontSize: 13 }}
                    aria-label={`Editar fuente ${f.nombre}`}
                    title="Editar fuente de energía"
                  >
                    ✎
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      alEliminar(f);
                    }}
                    style={{ background: "none", border: "none", color: colores.textDim, cursor: "pointer", fontSize: 15 }}
                    aria-label={`Eliminar fuente ${f.nombre}`}
                    title="Eliminar fuente de energía (los tableros que la usaban como origen quedan sin asignar, no se borran)"
                  >
                    ×
                  </button>
                </div>

                {activa && (
                  <div style={{ borderTop: `1px solid ${colores.border}`, padding: "10px 12px 12px 30px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {entradaIntegridad?.problemas?.length > 0 && (
                      <div>
                        {entradaIntegridad.problemas.map((p, i) => (
                          <div
                            key={i}
                            style={{ color: entradaIntegridad.estado === "error" ? colores.error : colores.warn, fontSize: 11.5, display: "flex", gap: 6, alignItems: "flex-start" }}
                            title="Integridad de datos, no cálculo eléctrico"
                          >
                            <span>🗂</span> <span>{p}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {f.notas && <div style={{ fontSize: 12, color: colores.textDim }}>{f.notas}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
