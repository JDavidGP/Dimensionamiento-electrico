import React, { useState } from "react";
import { colores, fuentes } from "../styles/colores";
import { inputStyle } from "./Campo";

// Mismo patrón de acordeón que TablaResultados: lista colapsada, clic
// despliega el detalle del tablero seleccionado (sus circuitos). Fase 3
// (dato relacional) — cero gráfico, eso es Fase 6 (esquema unifilar).
export default function PanelTableros({
  tableros,
  circuitosDeTablero,
  circuitosSinTablero,
  crearTablero,
  eliminarTablero,
}) {
  const [tableroActivoId, setTableroActivoId] = useState(null);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [tensionNueva, setTensionNueva] = useState("120");

  const sinAsignar = circuitosSinTablero();

  function alCrear(e) {
    e.preventDefault();
    if (!nombreNuevo.trim()) return;
    const t = crearTablero({ nombre: nombreNuevo, tensionAlimentacion: tensionNueva });
    setNombreNuevo("");
    setTensionNueva("120");
    setTableroActivoId(t.id); // lo abre de una, para ver que se creó bien
  }

  return (
    <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: 14 }}>
      <div style={{ fontSize: 11, color: colores.textDim, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
        Tableros
      </div>

      {/* Alta rápida */}
      <form onSubmit={alCrear} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          value={nombreNuevo}
          onChange={(e) => setNombreNuevo(e.target.value)}
          placeholder="Nombre del tablero"
          style={{ ...inputStyle(), flex: 1 }}
        />
        <input
          value={tensionNueva}
          onChange={(e) => setTensionNueva(e.target.value)}
          placeholder="V"
          type="number"
          style={{ ...inputStyle(), width: 70 }}
        />
        <button
          type="submit"
          disabled={!nombreNuevo.trim()}
          style={{
            padding: "0 14px",
            borderRadius: 3,
            border: "none",
            background: nombreNuevo.trim() ? colores.copper : colores.border,
            color: nombreNuevo.trim() ? "#171512" : colores.textDim,
            fontWeight: 700,
            fontSize: 12,
            cursor: nombreNuevo.trim() ? "pointer" : "not-allowed",
          }}
        >
          + Crear
        </button>
      </form>

      {tableros.length === 0 ? (
        <div style={{ color: colores.textDim, fontSize: 12.5, textAlign: "center", padding: "10px 0" }}>
          Todavía no creaste ningún tablero.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tableros.map((t) => {
            const circuitosDelTablero = circuitosDeTablero(t.id);
            const activo = tableroActivoId === t.id;
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: colores.textMain }}>{t.nombre}</div>
                    <div style={{ fontFamily: fuentes.mono, fontSize: 11, color: colores.textDim }}>
                      {t.tensionAlimentacion}V · {circuitosDelTablero.length} circuito{circuitosDelTablero.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      eliminarTablero(t.id);
                      if (activo) setTableroActivoId(null);
                    }}
                    style={{ background: "none", border: "none", color: colores.textDim, cursor: "pointer", fontSize: 15 }}
                    aria-label={`Eliminar tablero ${t.nombre}`}
                    title="Eliminar tablero (los circuitos quedan sin asignar, no se borran)"
                  >
                    ×
                  </button>
                </div>

                {activo && (
                  <div style={{ borderTop: `1px solid ${colores.border}` }}>
                    {circuitosDelTablero.length === 0 ? (
                      <div style={{ padding: "8px 12px 8px 30px", fontSize: 12, color: colores.textDim }}>
                        Sin circuitos asignados — usá el selector de tablero en cada circuito de la lista.
                      </div>
                    ) : (
                      circuitosDelTablero.map((c) => (
                        <div
                          key={c.id}
                          style={{ padding: "7px 12px 7px 30px", fontSize: 12.5, color: colores.textMain, borderBottom: `1px solid ${colores.border}` }}
                        >
                          {c.nombre || "(sin nombre)"}
                        </div>
                      ))
                    )}
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
