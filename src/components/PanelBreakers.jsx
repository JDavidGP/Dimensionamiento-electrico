import React from "react";
import { colores, fuentes } from "../styles/colores";

// Solo dibuja los breakers como "switches" de color según estado.
// No decide el estado — solo lo interpreta de `resultados`.
export default function PanelBreakers({ resultados }) {
  return (
    <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: 18 }}>
      <h2
        style={{
          fontFamily: fuentes.condensada,
          fontWeight: 600,
          fontSize: 13,
          letterSpacing: "0.08em",
          color: colores.textDim,
          margin: "0 0 14px 0",
          textTransform: "uppercase",
        }}
      >
        Panel de circuitos
      </h2>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {resultados.map((r, idx) => {
          const estado = !r.ok ? "error" : r.advertencias?.length ? "warn" : "ok";
          const color = colores[estado];
          return (
            <div key={r.id ?? idx} style={{ width: 92, textAlign: "center" }}>
              <div
                style={{
                  height: 44,
                  border: `1px solid ${color}`,
                  borderRadius: 3,
                  background: `${color}22`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: fuentes.mono,
                  fontWeight: 700,
                  fontSize: 14,
                  color,
                }}
              >
                {r.ok && r.breaker ? `${r.breaker}A` : "—"}
              </div>
              <div style={{ fontSize: 10, color: colores.textDim, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {r.nombre}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
