import React, { useState } from "react";
import { colores, fuentes } from "../styles/colores";
import Campo, { inputStyle } from "./Campo";

const FASES = [
  { valor: "mono", label: "Mono" },
  { valor: "bi", label: "Bi" },
  { valor: "tri", label: "Tri" },
];

const FORM_VACIO = {
  nombre: "",
  tensionAlimentacion: "120",
  fases: "mono",
  tableroPadreId: "", // "" = acometida/poste/transformador (sin padre)
  longitudAlimentador: "",
  materialAlimentador: "cobre",
};

function BotonPill({ activo, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: "7px 0",
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

// Bloque de resultado del alimentador (tramo troncal) de un tablero,
// tal como lo devuelve TableroMediator.calcularAlimentador. Cubre los
// tres estados posibles: pendiente (falta dato), error (no hay calibre
// que cumpla) y ok (dimensionado).
function BloqueAlimentador({ resultado }) {
  if (!resultado) return null;

  if (resultado.pendiente) {
    return (
      <div style={{ fontSize: 11.5, color: colores.textDim, lineHeight: 1.4 }}>
        Alimentador pendiente: {resultado.motivo}
      </div>
    );
  }

  if (!resultado.ok) {
    return (
      <div style={{ fontSize: 11.5, color: colores.error, lineHeight: 1.4 }}>
        ⚠ {resultado.error}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: fuentes.mono, fontSize: 11.5, color: colores.textMain, lineHeight: 1.6 }}>
      <div>
        Calibre: <strong>{resultado.seccion} {resultado.unidadSeccion}</strong> ({resultado.areaMm2.toFixed(2)} mm²) · Breaker: <strong>{resultado.breaker}A</strong>
      </div>
      <div style={{ color: colores.textDim }}>
        {resultado.corrienteDiseno.toFixed(2)}A diseño · caída {resultado.caidaPct.toFixed(2)}% · {resultado.cantidadCircuitos} circuito(s) agregados
      </div>
      {resultado.advertencias?.map((a, i) => (
        <div key={i} style={{ color: colores.warn }}>⚠ {a}</div>
      ))}
    </div>
  );
}

// Mismo patrón de acordeón que TablaResultados: lista colapsada, clic
// despliega el detalle del tablero seleccionado (sus circuitos y su
// alimentador ya calculado). Fase 3 (dato relacional) + Fase 4
// (alimentador: longitud, material, fases, tableroPadreId) — cero
// gráfico, eso es Fase 6 (esquema unifilar).
//
// tableroPadreId ya se captura y se puede elegir de entre los tableros
// existentes, pero encadenarlo hacia arriba (subpaneles, jerarquía
// visual) es el siguiente paso, no esta sesión — acá solo se muestra
// de qué tablero depende, sin construir el árbol completo.
export default function PanelTableros({
  tableros,
  circuitosDeTablero,
  circuitosSinTablero,
  alimentadores,
  crearTablero,
  editarTablero,
  eliminarTablero,
  listaIntegridad = [],
}) {
  const [tableroActivoId, setTableroActivoId] = useState(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  // Cuando se crea desde el botón "+ Agregar subtablero" de un tablero
  // puntual, el padre queda resuelto de una (no hay que buscarlo en el
  // dropdown) — guardamos el objeto completo para mostrar su nombre sin
  // tener que volver a buscarlo por id.
  const [padreForzado, setPadreForzado] = useState(null);

  const sinAsignar = circuitosSinTablero();

  function abrirCreacion() {
    setForm(FORM_VACIO);
    setEditandoId(null);
    setPadreForzado(null);
    setFormAbierto(true);
  }

  // Disparado desde el acordeón de un tablero ya existente: crea un
  // tablero nuevo con tableroPadreId ya resuelto a ESTE tablero — el
  // mismo formulario de siempre, solo que el campo "Tablero padre" no
  // hace falta buscarlo, ya se sabe de dónde cuelga.
  function abrirCreacionSubtablero(tableroPadre) {
    setForm({ ...FORM_VACIO, tableroPadreId: tableroPadre.id });
    setEditandoId(null);
    setPadreForzado(tableroPadre);
    setFormAbierto(true);
  }

  function abrirEdicion(t) {
    setForm({
      nombre: t.nombre,
      tensionAlimentacion: String(t.tensionAlimentacion),
      fases: t.fases,
      tableroPadreId: t.tableroPadreId ?? "",
      longitudAlimentador: t.longitudAlimentador ? String(t.longitudAlimentador) : "",
      materialAlimentador: t.materialAlimentador,
    });
    setEditandoId(t.id);
    setPadreForzado(null); // al editar, el padre sigue siendo elegible desde el dropdown
    setFormAbierto(true);
  }

  function cerrarForm() {
    setForm(FORM_VACIO);
    setEditandoId(null);
    setPadreForzado(null);
    setFormAbierto(false);
  }

  function alGuardar(e) {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    if (editandoId) {
      editarTablero(editandoId, form);
    } else {
      const t = crearTablero(form);
      setTableroActivoId(t.id); // lo abre de una, para ver que se creó bien
    }
    cerrarForm();
  }

  function alEliminar(t) {
    eliminarTablero(t.id);
    if (tableroActivoId === t.id) setTableroActivoId(null);
    if (editandoId === t.id) cerrarForm();
  }

  // Un tablero no puede ser su propio padre — filtro trivial de UI.
  // Nada más (ni ancestros, ni ciclos): esa lógica es el siguiente paso.
  const opcionesPadre = tableros.filter((t) => t.id !== editandoId);

  return (
    <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: colores.textDim, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Tableros
        </div>
        {!formAbierto && (
          <button
            onClick={abrirCreacion}
            style={{ padding: "4px 10px", borderRadius: 3, border: "none", background: colores.copper, color: "#171512", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}
          >
            + Nuevo tablero
          </button>
        )}
      </div>

      {formAbierto && (
        <form onSubmit={alGuardar} style={{ border: `1px solid ${colores.border}`, borderRadius: 4, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: colores.copper, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {editandoId ? "Editar tablero" : "Nuevo tablero"}
          </div>

          <Campo label="Nombre del tablero">
            <input
              style={inputStyle()}
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: Tablero principal, Subpanel cocina"
            />
          </Campo>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Campo label="Tensión alimentación (V)">
              <input
                style={inputStyle()}
                type="number"
                value={form.tensionAlimentacion}
                onChange={(e) => setForm({ ...form, tensionAlimentacion: e.target.value })}
              />
            </Campo>
            <Campo label="Fases del alimentador">
              <div style={{ display: "flex", gap: 6 }}>
                {FASES.map((f) => (
                  <BotonPill key={f.valor} activo={form.fases === f.valor} onClick={() => setForm({ ...form, fases: f.valor })}>
                    {f.label}
                  </BotonPill>
                ))}
              </div>
            </Campo>
          </div>

          {padreForzado ? (
            <Campo label="Tablero padre">
              <div style={{ ...inputStyle(), display: "flex", alignItems: "center", color: colores.textMain, background: "transparent" }}>
                Cuelga de: <strong style={{ marginLeft: 4 }}>{padreForzado.nombre}</strong>
              </div>
            </Campo>
          ) : (
            <Campo label="Tablero padre (opcional)">
              <select
                style={inputStyle()}
                value={form.tableroPadreId}
                onChange={(e) => setForm({ ...form, tableroPadreId: e.target.value })}
              >
                <option value="">— Acometida / poste / transformador —</option>
                {opcionesPadre.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Campo label="Longitud del alimentador (m)">
              <input
                style={inputStyle()}
                type="number"
                value={form.longitudAlimentador}
                onChange={(e) => setForm({ ...form, longitudAlimentador: e.target.value })}
                placeholder="Desde el origen"
              />
            </Campo>
            <Campo label="Material del alimentador">
              <div style={{ display: "flex", gap: 6 }}>
                {["cobre", "aluminio"].map((m) => (
                  <BotonPill key={m} activo={form.materialAlimentador === m} onClick={() => setForm({ ...form, materialAlimentador: m })}>
                    <span style={{ textTransform: "capitalize" }}>{m}</span>
                  </BotonPill>
                ))}
              </div>
            </Campo>
          </div>
          <div style={{ fontSize: 10.5, color: colores.textDim, lineHeight: 1.4, margin: "-4px 0 12px" }}>
            Distancia medida desde el poste, el tablero padre o el transformador de energía hasta este tablero.
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              disabled={!form.nombre.trim()}
              style={{
                flex: 1,
                padding: "9px 0",
                borderRadius: 3,
                border: "none",
                background: form.nombre.trim() ? colores.copper : colores.border,
                color: form.nombre.trim() ? "#171512" : colores.textDim,
                fontWeight: 700,
                fontSize: 13,
                cursor: form.nombre.trim() ? "pointer" : "not-allowed",
              }}
            >
              {editandoId ? "Guardar cambios" : "+ Crear tablero"}
            </button>
            <button
              type="button"
              onClick={cerrarForm}
              style={{ padding: "9px 14px", background: "transparent", color: colores.textDim, border: `1px solid ${colores.border}`, borderRadius: 3, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {tableros.length === 0 ? (
        <div style={{ color: colores.textDim, fontSize: 12.5, textAlign: "center", padding: "10px 0" }}>
          Todavía no creaste ningún tablero.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tableros.map((t) => {
            const circuitosDelTablero = circuitosDeTablero(t.id);
            const padre = t.tableroPadreId ? tableros.find((p) => p.id === t.tableroPadreId) : null;
            const activo = tableroActivoId === t.id;
            // Integridad de ESTE tablero (tableroPadreId inexistente,
            // auto-referencia, sin circuitos asociados) — mismo patrón
            // que TablaResultados.jsx ya usa para circuitos, hasta hoy
            // nunca conectado acá.
            const entradaIntegridad = listaIntegridad.find((e) => e.tipo === "tablero" && e.id === t.id);
            const colorEstado = entradaIntegridad
              ? entradaIntegridad.estado === "error"
                ? colores.error
                : entradaIntegridad.estado === "advertencia"
                  ? colores.warn
                  : colores.ok
              : colores.ok;
            return (
              <div
                key={t.id}
                style={{
                  border: `1px solid ${activo ? colores.copper : colores.border}`,
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  onClick={() => setTableroActivoId(activo ? null : t.id)}
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
                      {t.tensionAlimentacion}V · {t.fases} · {circuitosDelTablero.length} circuito{circuitosDelTablero.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirEdicion(t);
                    }}
                    style={{ background: "none", border: "none", color: colores.textDim, cursor: "pointer", fontSize: 13 }}
                    aria-label={`Editar tablero ${t.nombre}`}
                    title="Editar tablero"
                  >
                    ✎
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      alEliminar(t);
                    }}
                    style={{ background: "none", border: "none", color: colores.textDim, cursor: "pointer", fontSize: 15 }}
                    aria-label={`Eliminar tablero ${t.nombre}`}
                    title="Eliminar tablero (los circuitos quedan sin asignar, no se borran)"
                  >
                    ×
                  </button>
                </div>

                {activo && (
                  <div style={{ borderTop: `1px solid ${colores.border}`, padding: "10px 12px 12px 30px", display: "flex", flexDirection: "column", gap: 10 }}>
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

                    <div style={{ fontSize: 11.5, color: colores.textDim, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <span>
                        Alimenta desde: <strong style={{ color: colores.textMain }}>{padre ? padre.nombre : "Acometida / poste / transformador principal"}</strong>
                        {t.longitudAlimentador > 0 && ` · ${t.longitudAlimentador}m de ${t.materialAlimentador}`}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirCreacionSubtablero(t);
                        }}
                        style={{ flexShrink: 0, padding: "3px 8px", borderRadius: 3, border: `1px solid ${colores.border}`, background: "transparent", color: colores.copper, fontWeight: 700, fontSize: 11, cursor: "pointer" }}
                      >
                        + Subtablero
                      </button>
                    </div>

                    <BloqueAlimentador resultado={alimentadores?.[t.id]} />

                    <div>
                      <div style={{ fontSize: 10.5, color: colores.textDim, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                        Circuitos
                      </div>
                      {circuitosDelTablero.length === 0 ? (
                        <div style={{ fontSize: 12, color: colores.textDim }}>
                          Sin circuitos asignados — usá el selector de tablero en cada circuito de la lista.
                        </div>
                      ) : (
                        circuitosDelTablero.map((c) => (
                          <div key={c.id} style={{ fontSize: 12.5, color: colores.textMain, padding: "3px 0" }}>
                            {c.nombre || "(sin nombre)"}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {sinAsignar.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${colores.border}` }}>
          <div style={{ fontSize: 11, color: colores.warn }}>
            ⚠ {sinAsignar.length} circuito{sinAsignar.length !== 1 ? "s" : ""} sin tablero asignado todavía.
          </div>
        </div>
      )}
    </div>
  );
}
