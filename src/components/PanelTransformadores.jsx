import React, { useState } from "react";
import { colores, fuentes } from "../styles/colores";
import Campo, { inputStyle } from "./Campo";
import { BotonPill } from "./PanelTableros";

// Lista propia de Transformadores, con su CRUD completo — mismo patrón
// de acordeón que PanelFuentesEnergia.jsx antes de su rediseño en dos
// cuadros (acá no hace falta: Transformador no tiene un "rol" de
// instalación como las fuentes, solo se crea/edita/elimina). Antes solo
// se podía CREAR desde el mini-formulario inline del selector "Fuente
// de energía" de un tablero (que sigue existiendo, es un atajo útil);
// editarTransformador/liberarTablerosDeTransformador ya existían en el
// hook (ver modules/motor/transformador.js), solo faltaba conectarlos a
// una pantalla (usuario, 2026-11-20).
//
// Capacidad (kVA), conexión Y/Δ y %Z siguen sin campo acá a propósito
// — "nos hace falta datos para desarrollar ese apartado" (usuario,
// 2026-11-19, todavía vigente): el formulario solo cubre los campos que
// YA tenía el mini-formulario inline (nombre/fases/tensiones) más
// Notas, igual criterio que el resto de las entidades de la app.
const FORM_VACIO = { nombre: "", fases: "tri", tensionPrimariaV: "", tensionSecundariaV: "", notas: "" };
const FASES_TRANSFORMADOR = [
  { valor: "mono", label: "Mono" },
  { valor: "tri", label: "Tri" },
];

function colorEstadoDe(entrada) {
  if (!entrada) return colores.ok;
  if (entrada.estado === "error") return colores.error;
  if (entrada.estado === "advertencia") return colores.warn;
  return colores.ok;
}

export default function PanelTransformadores({ transformadores = [], crearTransformador, editarTransformador, eliminarTransformador, listaIntegridad = [] }) {
  const [activoId, setActivoId] = useState(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);

  function abrirCreacion() {
    setForm(FORM_VACIO);
    setEditandoId(null);
    setFormAbierto(true);
  }

  function abrirEdicion(t) {
    setForm({
      nombre: t.nombre,
      fases: t.fases,
      tensionPrimariaV: t.tensionPrimariaV ? String(t.tensionPrimariaV) : "",
      tensionSecundariaV: t.tensionSecundariaV ? String(t.tensionSecundariaV) : "",
      notas: t.notas || "",
    });
    setEditandoId(t.id);
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
      editarTransformador(editandoId, form);
    } else {
      const t = crearTransformador(form);
      setActivoId(t.id);
    }
    cerrarForm();
  }

  function alEliminar(t) {
    eliminarTransformador(t.id);
    if (activoId === t.id) setActivoId(null);
    if (editandoId === t.id) cerrarForm();
  }

  return (
    <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: colores.textDim, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Transformadores
        </div>
        {!formAbierto && (
          <button
            onClick={abrirCreacion}
            style={{ padding: "4px 10px", borderRadius: 3, border: "none", background: colores.copper, color: "#171512", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}
          >
            + Nuevo transformador
          </button>
        )}
      </div>

      {formAbierto && (
        <form onSubmit={alGuardar} style={{ border: `1px solid ${colores.border}`, borderRadius: 4, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: colores.copper, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {editandoId ? "Editar transformador" : "Nuevo transformador"}
          </div>

          <Campo label="Nombre">
            <input
              style={inputStyle()}
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: Transformador reductor 480V→240V"
            />
          </Campo>

          <Campo label="Fases">
            <div style={{ display: "flex", gap: 6 }}>
              {FASES_TRANSFORMADOR.map((f) => (
                <BotonPill key={f.valor} activo={form.fases === f.valor} onClick={() => setForm({ ...form, fases: f.valor })}>
                  {f.label}
                </BotonPill>
              ))}
            </div>
          </Campo>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Campo label="Tensión primaria (V)">
              <input
                type="number"
                style={inputStyle()}
                value={form.tensionPrimariaV}
                onChange={(e) => setForm({ ...form, tensionPrimariaV: e.target.value })}
                placeholder="Ej: 480"
              />
            </Campo>
            <Campo label="Tensión secundaria (V)">
              <input
                type="number"
                style={inputStyle()}
                value={form.tensionSecundariaV}
                onChange={(e) => setForm({ ...form, tensionSecundariaV: e.target.value })}
                placeholder="Ej: 240"
              />
            </Campo>
          </div>

          <Campo label="Notas (opcional)">
            <input
              style={inputStyle()}
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              placeholder="Cualquier detalle útil para la memoria del proyecto"
            />
          </Campo>

          <div style={{ fontSize: 10.5, color: colores.textDim, lineHeight: 1.4, margin: "-4px 0 12px" }}>
            Capacidad (kVA), conexión Y/Δ y %Z todavía no tienen campo acá — se completan más adelante, cuando haya un proyecto
            industrial real que los necesite.
          </div>

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
              {editandoId ? "Guardar cambios" : "+ Crear transformador"}
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

      {transformadores.length === 0 && !formAbierto && (
        <div style={{ fontSize: 12, color: colores.textDim }}>
          Sin transformadores todavía — "+ Nuevo transformador" acá, o desde el selector "Fuente de energía" al crear/editar un
          tablero.
        </div>
      )}

      {transformadores.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {transformadores.map((t) => {
            const activo = activoId === t.id;
            const entradaIntegridad = listaIntegridad.find((e) => e.tipo === "transformador" && e.id === t.id);
            const colorEstado = colorEstadoDe(entradaIntegridad);
            return (
              <div key={t.id} style={{ border: `1px solid ${activo ? colores.copper : colores.border}`, borderRadius: 4, overflow: "hidden" }}>
                <div
                  onClick={() => setActivoId(activo ? null : t.id)}
                  style={{
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: "pointer",
                    background: activo ? `${colores.copper}14` : "transparent",
                  }}
                >
                  <span style={{ color: colores.textDim, fontSize: 11, width: 12, textAlign: "center" }}>{activo ? "▾" : "▸"}</span>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: colorEstado, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: colores.textMain }}>{t.nombre}</div>
                    <div style={{ fontFamily: fuentes.mono, fontSize: 11, color: colores.textDim }}>
                      {t.fases}
                      {t.tensionPrimariaV && t.tensionSecundariaV ? ` · ${t.tensionPrimariaV}V→${t.tensionSecundariaV}V` : ""}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirEdicion(t);
                    }}
                    style={{ background: "none", border: "none", color: colores.textDim, cursor: "pointer", fontSize: 13 }}
                    aria-label={`Editar transformador ${t.nombre}`}
                    title="Editar transformador"
                  >
                    ✎
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      alEliminar(t);
                    }}
                    style={{ background: "none", border: "none", color: colores.textDim, cursor: "pointer", fontSize: 15 }}
                    aria-label={`Eliminar transformador ${t.nombre}`}
                    title="Eliminar transformador (los tableros que lo usaban como origen quedan sin asignar, no se borran)"
                  >
                    ×
                  </button>
                </div>

                {activo && (
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
                    {t.notas && <div style={{ fontSize: 12, color: colores.textDim }}>{t.notas}</div>}
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
