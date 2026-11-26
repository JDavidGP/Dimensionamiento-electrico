import React from "react";
import { colores } from "../styles/colores";

// Envuelve un input/select con su etiqueta. No sabe nada de cálculos.
// La etiqueta tiene una altura reservada fija (con nowrap + ellipsis) para
// que un texto más largo (ej. al cambiar "Potencia" por "Corriente") no
// haga crecer la fila y desplace verticalmente el resto del formulario.
export default function Campo({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label
        title={label}
        style={{
          display: "block",
          height: 14,
          lineHeight: "14px",
          fontSize: 11,
          color: colores.textDim,
          marginBottom: 4,
          letterSpacing: "0.03em",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function inputStyle() {
  return {
    width: "100%",
    padding: "8px 10px",
    background: colores.bg,
    border: `1px solid ${colores.border}`,
    borderRadius: 3,
    color: colores.textMain,
    fontSize: 13,
    boxSizing: "border-box",
  };
}

// Extraída de PanelDiferenciales/PanelFuentesEnergia/PanelTransformadores
// (auditoría 2026-11-26: las 3 tenían la misma función copiada letra por
// letra) — color del borde/indicador de una tarjeta de entidad según su
// peor estado de integridad referencial (ver modules/validacion/referencial.ts).
export function colorEstadoDe(entrada) {
  if (!entrada) return colores.ok;
  if (entrada.estado === "error") return colores.error;
  if (entrada.estado === "advertencia") return colores.warn;
  return colores.ok;
}
