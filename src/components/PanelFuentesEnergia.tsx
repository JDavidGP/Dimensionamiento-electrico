import { useState, type FormEvent } from "react";
import { colores, fuentes } from "../styles/colores.ts";
import Campo, { inputStyle, colorEstadoDe } from "./Campo.tsx";
import { TIPOS_FUENTE_UI, BotonPill } from "./PanelTableros";
import type { FuenteEnergia } from "../core/services/DataProvider.ts";
import type { DatosFuenteEnergia } from "../modules/origen/tipos.ts";
import type { Entrada } from "../modules/validacion/index.ts";

// Rediseño (usuario, 2026-11-20, con el ejemplo de las 3 casas: solo
// red local / red local + generador / las 3 fuentes): el cuadro de
// ARRIBA declara rápido qué fuente existe y qué rol global juega en la
// instalación (principal/secundaria/auxiliar — uno de cada, para toda
// la instalación, ver ROLES_FUENTE en modules/origen/fuentesEnergia.js)
// y solo guarda eso. El cuadro de ABAJO es la lista de fuentes ya
// declaradas — tocar una la expande para configurar sus características
// (entrada de energía prevista, distancia de conexión, material del
// conductor, horario de uso, notas), sin volver a tocar qué ES ni qué
// ROL juega (aunque ambos siguen editables ahí si hace falta corregirlos).
//
// "Red local" (red eléctrica pública) es ahora una fuente más, creable
// igual que batería/generador — antes solo existía como condición
// implícita (tableroPadreId null, sin datos propios). Ver la nota larga
// en modules/origen/fuentesEnergia.js para por qué esto es aditivo y no
// rompe proyectos viejos (ese null sigue significando "acometida
// genérica, sin detalle").
interface FormCrearFuente {
  nombre: string;
  tipo: string;
  rol: string;
}

interface FormDetalleFuente {
  nombre: string;
  tipo: string;
  rol: string;
  capacidadKW: string;
  distanciaM: string;
  materialConductor: string;
  horarioInicio: string;
  horarioFin: string;
  notas: string;
}

const FORM_CREAR_VACIO: FormCrearFuente = { nombre: "", tipo: "red_local", rol: "" };

const ROLES_UI = [
  { valor: "principal", label: "Principal" },
  { valor: "secundaria", label: "Secundaria" },
  { valor: "auxiliar", label: "Auxiliar" },
];

function formDetalleDesde(f: FuenteEnergia): FormDetalleFuente {
  return {
    nombre: f.nombre,
    tipo: f.tipo,
    rol: f.rol || "",
    capacidadKW: f.capacidadKW === "" || f.capacidadKW == null ? "" : String(f.capacidadKW),
    distanciaM: f.distanciaM === "" || f.distanciaM == null ? "" : String(f.distanciaM),
    materialConductor: f.materialConductor || "cobre",
    horarioInicio: f.horarioInicio || "",
    horarioFin: f.horarioFin || "",
    notas: f.notas || "",
  };
}

interface PanelFuentesEnergiaProps {
  fuentesEnergia?: FuenteEnergia[];
  crearFuenteEnergia: (datos: DatosFuenteEnergia) => FuenteEnergia;
  editarFuenteEnergia: (id: string, cambios: DatosFuenteEnergia) => void;
  eliminarFuenteEnergia: (id: string) => void;
  listaIntegridad?: Entrada[];
}

export default function PanelFuentesEnergia({ fuentesEnergia = [], crearFuenteEnergia, editarFuenteEnergia, eliminarFuenteEnergia, listaIntegridad = [] }: PanelFuentesEnergiaProps) {
  const [activaId, setActivaId] = useState<string | null>(null);
  const [formCrear, setFormCrear] = useState<FormCrearFuente>(FORM_CREAR_VACIO);
  const [formDetalle, setFormDetalle] = useState<FormDetalleFuente | null>(null);

  function rolTomadoPor(rol: string, excluirId: string | null): FuenteEnergia | null {
    if (!rol) return null;
    return fuentesEnergia.find((f) => f.rol === rol && f.id !== excluirId) || null;
  }

  // Los formularios (FormCrearFuente/FormDetalleFuente) son todo texto
  // (estado de UI, ver el mismo criterio que FormularioCircuito/Equipo)
  // — crearFuenteEnergia/editarFuenteEnergia (modules/origen/fuentesEnergia.ts,
  // función `normalizar`) ya toleran strings en runtime (Number(...)||0),
  // el cast solo declara esa tolerancia que DatosFuenteEnergia no refleja.
  function alCrear(e: FormEvent): void {
    e.preventDefault();
    if (!formCrear.nombre.trim()) return;
    const f = crearFuenteEnergia(formCrear as unknown as DatosFuenteEnergia);
    setFormCrear(FORM_CREAR_VACIO);
    setActivaId(f.id);
    setFormDetalle(formDetalleDesde(f));
  }

  function alExpandir(f: FuenteEnergia): void {
    if (activaId === f.id) {
      setActivaId(null);
      setFormDetalle(null);
    } else {
      setActivaId(f.id);
      setFormDetalle(formDetalleDesde(f));
    }
  }

  function alGuardarDetalle(e: FormEvent): void {
    e.preventDefault();
    if (!formDetalle || !formDetalle.nombre.trim() || !activaId) return;
    editarFuenteEnergia(activaId, formDetalle as unknown as DatosFuenteEnergia);
  }

  function alEliminar(f: FuenteEnergia): void {
    eliminarFuenteEnergia(f.id);
    if (activaId === f.id) {
      setActivaId(null);
      setFormDetalle(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* --- Cuadro de arriba: declarar fuente + rol en la instalación --- */}
      <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: 14 }}>
        <div style={{ fontSize: 11, color: colores.textDim, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
          Declarar fuente de energía
        </div>
        <form onSubmit={alCrear}>
          <Campo label="Nombre">
            <input
              style={inputStyle()}
              value={formCrear.nombre}
              onChange={(e) => setFormCrear({ ...formCrear, nombre: e.target.value })}
              placeholder="Ej: Red eléctrica local, Generador diesel 10kW"
            />
          </Campo>

          <Campo label="Tipo">
            <div style={{ display: "flex", gap: 6 }}>
              {TIPOS_FUENTE_UI.map((t) => (
                <BotonPill key={t.valor} activo={formCrear.tipo === t.valor} onClick={() => setFormCrear({ ...formCrear, tipo: t.valor })}>
                  {t.label}
                </BotonPill>
              ))}
            </div>
          </Campo>

          <Campo label="Rol en la instalación (opcional)">
            <div style={{ display: "flex", gap: 6 }}>
              {ROLES_UI.map((r) => (
                <BotonPill
                  key={r.valor}
                  activo={formCrear.rol === r.valor}
                  onClick={() => setFormCrear({ ...formCrear, rol: formCrear.rol === r.valor ? "" : r.valor })}
                >
                  {r.label}
                </BotonPill>
              ))}
            </div>
            {formCrear.rol && rolTomadoPor(formCrear.rol, null) && (
              <div style={{ fontSize: 10.5, color: colores.warn, marginTop: 4 }}>
                Le quitará el rol "{ROLES_UI.find((r) => r.valor === formCrear.rol)?.label}" a "{rolTomadoPor(formCrear.rol, null)?.nombre}" (solo puede
                haber una fuente con cada rol).
              </div>
            )}
          </Campo>

          <button
            type="submit"
            disabled={!formCrear.nombre.trim()}
            style={{
              width: "100%",
              padding: "8px 0",
              borderRadius: 3,
              border: "none",
              background: formCrear.nombre.trim() ? colores.copper : colores.border,
              color: formCrear.nombre.trim() ? colores.textSobreAcento : colores.textDim,
              fontWeight: 700,
              fontSize: 12.5,
              cursor: formCrear.nombre.trim() ? "pointer" : "not-allowed",
            }}
          >
            + Crear fuente
          </button>
        </form>
      </div>

      {/* --- Cuadro de abajo: tocar una fuente para configurar sus características --- */}
      <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: 14 }}>
        <div style={{ fontSize: 11, color: colores.textDim, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
          Configurar características
        </div>

        {fuentesEnergia.length === 0 && (
          <div style={{ fontSize: 12, color: colores.textDim }}>Todavía no declaraste ninguna fuente de energía arriba.</div>
        )}

        {fuentesEnergia.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {fuentesEnergia.map((f) => {
              const activa = activaId === f.id;
              const entradaIntegridad = listaIntegridad.find((e) => e.tipo === "fuenteEnergia" && e.id === f.id);
              const colorEstado = colorEstadoDe(entradaIntegridad);
              const tipoLabel = TIPOS_FUENTE_UI.find((t) => t.valor === f.tipo)?.label ?? f.tipo;
              const rolLabel = ROLES_UI.find((r) => r.valor === f.rol)?.label;
              return (
                <div key={f.id} style={{ border: `1px solid ${activa ? colores.copper : colores.border}`, borderRadius: 4, overflow: "hidden" }}>
                  <div
                    onClick={() => alExpandir(f)}
                    style={{
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      cursor: "pointer",
                      background: activa ? colores.copperFondo : "transparent",
                    }}
                  >
                    <span style={{ color: colores.textDim, fontSize: 11, width: 12, textAlign: "center" }}>{activa ? "▾" : "▸"}</span>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: colorEstado, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5, color: colores.textMain }}>{f.nombre}</div>
                      <div style={{ fontFamily: fuentes.mono, fontSize: 11, color: colores.textDim }}>
                        {tipoLabel}
                        {rolLabel ? ` · ${rolLabel}` : ""}
                        {f.capacidadKW !== "" && f.capacidadKW != null ? ` · ${f.capacidadKW} kW` : ""}
                      </div>
                    </div>
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

                  {activa && formDetalle && (
                    <form
                      onSubmit={alGuardarDetalle}
                      style={{ borderTop: `1px solid ${colores.border}`, padding: "10px 12px 12px 30px", display: "flex", flexDirection: "column", gap: 8 }}
                    >
                      {entradaIntegridad && entradaIntegridad.problemas.length > 0 && (
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

                      <Campo label="Nombre">
                        <input
                          style={inputStyle()}
                          value={formDetalle.nombre}
                          onChange={(e) => setFormDetalle({ ...formDetalle, nombre: e.target.value })}
                        />
                      </Campo>

                      <Campo label="Tipo">
                        <div style={{ display: "flex", gap: 6 }}>
                          {TIPOS_FUENTE_UI.map((t) => (
                            <BotonPill key={t.valor} activo={formDetalle.tipo === t.valor} onClick={() => setFormDetalle({ ...formDetalle, tipo: t.valor })}>
                              {t.label}
                            </BotonPill>
                          ))}
                        </div>
                      </Campo>

                      <Campo label="Rol en la instalación (opcional)">
                        <div style={{ display: "flex", gap: 6 }}>
                          {ROLES_UI.map((r) => (
                            <BotonPill
                              key={r.valor}
                              activo={formDetalle.rol === r.valor}
                              onClick={() => setFormDetalle({ ...formDetalle, rol: formDetalle.rol === r.valor ? "" : r.valor })}
                            >
                              {r.label}
                            </BotonPill>
                          ))}
                        </div>
                        {formDetalle.rol && rolTomadoPor(formDetalle.rol, f.id) && (
                          <div style={{ fontSize: 10.5, color: colores.warn, marginTop: 4 }}>
                            Le quitará el rol "{ROLES_UI.find((r) => r.valor === formDetalle.rol)?.label}" a "{rolTomadoPor(formDetalle.rol, f.id)?.nombre}".
                          </div>
                        )}
                      </Campo>

                      <Campo label="Entrada de energía prevista (kW, opcional)">
                        <input
                          type="number"
                          style={inputStyle()}
                          value={formDetalle.capacidadKW}
                          onChange={(e) => setFormDetalle({ ...formDetalle, capacidadKW: e.target.value })}
                          placeholder="Ej: 10"
                        />
                      </Campo>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <Campo label="Distancia donde se conecta (m)">
                          <input
                            type="number"
                            style={inputStyle()}
                            value={formDetalle.distanciaM}
                            onChange={(e) => setFormDetalle({ ...formDetalle, distanciaM: e.target.value })}
                            placeholder="Ej: 15"
                          />
                        </Campo>
                        <Campo label="Material del conductor">
                          <div style={{ display: "flex", gap: 6 }}>
                            {["cobre", "aluminio"].map((m) => (
                              <BotonPill
                                key={m}
                                activo={formDetalle.materialConductor === m}
                                onClick={() => setFormDetalle({ ...formDetalle, materialConductor: m })}
                              >
                                <span style={{ textTransform: "capitalize" }}>{m}</span>
                              </BotonPill>
                            ))}
                          </div>
                        </Campo>
                      </div>
                      <div style={{ fontSize: 10.5, color: colores.textDim, lineHeight: 1.4, marginTop: -4 }}>
                        Si un tablero cuelga directo de esta fuente y no declaró su propia distancia, el cálculo del alimentador usa esta como respaldo.
                      </div>

                      <Campo label="Horario de uso (opcional — vacío = sin restricción)">
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 10, color: colores.textDim, marginBottom: 4 }}>Desde:</div>
                            <input
                              type="time"
                              style={inputStyle()}
                              value={formDetalle.horarioInicio}
                              onChange={(e) => setFormDetalle({ ...formDetalle, horarioInicio: e.target.value })}
                            />
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: colores.textDim, marginBottom: 4 }}>Hasta:</div>
                            <input
                              type="time"
                              style={inputStyle()}
                              value={formDetalle.horarioFin}
                              onChange={(e) => setFormDetalle({ ...formDetalle, horarioFin: e.target.value })}
                            />
                          </div>
                        </div>
                      </Campo>

                      <Campo label="Notas (opcional)">
                        <input
                          style={inputStyle()}
                          value={formDetalle.notas}
                          onChange={(e) => setFormDetalle({ ...formDetalle, notas: e.target.value })}
                          placeholder="Cualquier detalle útil para la memoria del proyecto"
                        />
                      </Campo>

                      <button
                        type="submit"
                        style={{ padding: "8px 0", borderRadius: 3, border: "none", background: colores.copper, color: colores.textSobreAcento, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
                      >
                        Guardar cambios
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
