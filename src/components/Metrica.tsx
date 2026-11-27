import React from "react";
import { colores, fuentes } from "../styles/colores.ts";

interface MetricaProps {
  label: React.ReactNode;
  valor: React.ReactNode;
}

// Solo dibuja una tarjeta con un número grande. No calcula nada.
export default function Metrica({ label, valor }: MetricaProps) {
  return (
    <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: "10px 16px", minWidth: 120 }}>
      <div style={{ fontSize: 10, color: colores.textDim, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: fuentes.mono, fontSize: 20, color: colores.textMain, fontWeight: 700, marginTop: 2 }}>{valor}</div>
    </div>
  );
}
