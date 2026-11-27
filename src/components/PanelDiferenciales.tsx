import { useState, type FormEvent } from "react";
import { colores, fuentes } from "../styles/colores.ts";
import Campo, { inputStyle, colorEstadoDe } from "./Campo.tsx";
import type { Diferencial, DatosDiferencial } from "../modules/diferencial/tipos.ts";
import type { Entrada } from "../modules/validacion/index.ts";

interface FormDiferencial {
  nombre: string;
  sensibilidadMA: string;
  notas: string;
}

// Lista propia de Diferenciales (ID), con su CRUD completo — mismo
// patrón exacto que PanelTransformadores.jsx. REBT ITC-BT-25, cita
// exacta: "garantizando un máximo de cinco circuitos por cada
// diferencial" — usuario, 2026-11-25: "El diferencial se supone que
// agrupa x cantidad de PIA según normativa... así que supongo que si
// debería tener su propio marcador en el plano", y confirmó el límite
// FIJO (no varía por tipo de instalación): "usa el 5 fijo por ahora".
// NEC/CIEN no tienen este concepto de agrupación (GFCI/AFCI van por
// circuito, no por bloque de 5) — este panel se renderiza SOLO bajo
// IEC_ES (ver App.jsx), mismo criterio que PanelFuentesEnergia/
// PanelTransformadores con sus bloques REBT.
const FORM_VACIO: FormDiferencial = { nombre: "", sensibilidadMA: "30", notas: "" };

interface PanelDiferencialesProps {
  diferenciales?: Diferencial[];
  crearDiferencial: (datos: DatosDiferencial) => Diferencial;
  editarDiferencial: (id: string, cambios: DatosDiferencial) => void;
  eliminarDiferencial: (id: string) => void;
  listaIntegridad?: Entrada[];
}

export default function PanelDiferenciales({ diferenciales = [], crearDiferencial, editarDiferencial, eliminarDiferencial, listaIntegridad = [] }: PanelDiferencialesProps) {
  const [activoId, setActivoId] = useState<string | null>(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormDiferencial>(FORM_VACIO);

  function abrirCreacion() {
    setForm(FORM_VACIO);
    setEditandoId(null);
    setFormAbierto(true);
  }

  function abrirEdicion(d: Diferencial): void {
    setForm({
      nombre: d.nombre,
      sensibilidadMA: d.sensibilidadMA ? String(d.sensibilidadMA) : "30",
      notas: d.notas || "",
    });
    setEditandoId(d.id);
    setFormAbierto(true);
  }

  function cerrarForm() {
    setForm(FORM_VACIO);
    setEditandoId(null);
    setFormAbierto(false);
  }

  function alGuardar(e: FormEvent): void {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    if (editandoId) {
      editarDiferencial(editandoId, form);
    } else {
      const d = crearDiferencial(form);
      setActivoId(d.id);
    }
    cerrarForm();
  }

  function alEliminar(d: Diferencial): void {
    eliminarDiferencial(d.id);
    if (activoId === d.id) setActivoId(null);
    if (editandoId === d.id) cerrarForm();
  }

  return (
    <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: colores.textDim, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Diferenciales (ID)
        </div>
        {!formAbierto && (
          <button
            onClick={abrirCreacion}
            style={{ padding: "4px 10px", borderRadius: 3, border: "none", background: colores.copper, color: colores.textSobreAcento, fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}
          >
            + Nuevo diferencial
          </button>
        )}
      </div>

      {formAbierto && (
        <form onSubmit={alGuardar} style={{ border: `1px solid ${colores.border}`, borderRadius: 4, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: colores.copper, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {editandoId ? "Editar diferencial" : "Nuevo diferencial"}
          </div>

          <Campo label="Nombre">
            <input
              style={inputStyle()}
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: ID planta baja"
            />
          </Campo>

          <Campo label="Sensibilidad (mA)">
            <input
              type="number"
              style={inputStyle()}
              value={form.sensibilidadMA}
              onChange={(e) => setForm({ ...form, sensibilidadMA: e.target.value })}
              placeholder="Ej: 30"
            />
          </Campo>

          <Campo label="Notas (opcional)">
            <input
              style={inputStyle()}
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              placeholder="Cualquier detalle útil para la memoria del proyecto"
            />
          </Campo>

          <div style={{ fontSize: 10.5, color: colores.textDim, lineHeight: 1.4, margin: "-4px 0 12px" }}>
            ITC-BT-25: máximo 5 circuitos por diferencial — si se agrupan más, aparece una advertencia (abajo, en la tarjeta del
            diferencial) para repartirlos en más de uno.
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
                color: form.nombre.trim() ? colores.textSobreAcento : colores.textDim,
                fontWeight: 700,
                fontSize: 12.5,
                cursor: form.nombre.trim() ? "pointer" : "not-allowed",
              }}
            >
              {editandoId ? "Guardar cambios" : "+ Crear diferencial"}
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

      {diferenciales.length === 0 && !formAbierto && (
        <div style={{ fontSize: 12, color: colores.textDim }}>
          Sin diferenciales todavía — "+ Nuevo diferencial" acá, y después asigná cada circuito a uno desde "Circuitos y
          resultados".
        </div>
      )}

      {diferenciales.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {diferenciales.map((d) => {
            const activo = activoId === d.id;
            const entradaIntegridad = listaIntegridad.find((e) => e.tipo === "diferencial" && e.id === d.id);
            const colorEstado = colorEstadoDe(entradaIntegridad);
            return (
              <div key={d.id} style={{ border: `1px solid ${activo ? colores.copper : colores.border}`, borderRadius: 4, overflow: "hidden" }}>
                <div
                  onClick={() => setActivoId(activo ? null : d.id)}
                  style={{
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: "pointer",
                    background: activo ? colores.copperFondo : "transparent",
                  }}
                >
                  <span style={{ color: colores.textDim, fontSize: 11, width: 12, textAlign: "center" }}>{activo ? "▾" : "▸"}</span>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: colorEstado, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: colores.textMain }}>{d.nombre}</div>
                    <div style={{ fontFamily: fuentes.mono, fontSize: 11, color: colores.textDim }}>
                      {entradaIntegridad?.resumen ?? `${d.sensibilidadMA ?? 30}mA`}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirEdicion(d);
                    }}
                    style={{ background: "none", border: "none", color: colores.textDim, cursor: "pointer", fontSize: 13 }}
                    aria-label={`Editar diferencial ${d.nombre}`}
                    title="Editar diferencial"
                  >
                    ✎
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      alEliminar(d);
                    }}
                    style={{ background: "none", border: "none", color: colores.textDim, cursor: "pointer", fontSize: 15 }}
                    aria-label={`Eliminar diferencial ${d.nombre}`}
                    title="Eliminar diferencial (los circuitos que agrupaba quedan sin asignar, no se borran)"
                  >
                    ×
                  </button>
                </div>

                {activo && entradaIntegridad && entradaIntegridad.problemas.length > 0 && (
                  <div style={{ borderTop: `1px solid ${colores.border}`, padding: "10px 12px 12px 30px" }}>
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
                {activo && d.notas && (
                  <div style={{ borderTop: `1px solid ${colores.border}`, padding: "10px 12px 12px 30px", fontSize: 12, color: colores.textDim }}>{d.notas}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
