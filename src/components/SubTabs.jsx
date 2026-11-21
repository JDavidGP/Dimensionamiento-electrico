import React from "react";
import { colores } from "../styles/colores";

// Sub-pestañas DENTRO de una pestaña principal — pedido explícito del
// usuario (2026-11-20): agrupar Diagrama unifilar y Plano bajo un
// mismo apartado ("Esquemas") sin fusionar sus lienzos (cada uno
// sigue siendo su propio editor, con su propio modelo de datos — ver
// la nota de arquitectura en modules/plano/index.js sobre por qué esa
// separación es deliberada).
//
// Variante de TabsViewPager.jsx SIN gestos táctiles — a propósito: si
// esto tuviera su propio swipe, el toque se propagaría hacia el
// TabsViewPager EXTERIOR (que sí escucha touch en todo su contenedor)
// y las dos capas competirían por el mismo gesto horizontal. Acá
// alcanza con click — es solo 2 opciones, no una fila larga de
// pestañas para deslizar. Mismo criterio de "todos los paneles
// montados siempre" que TabsViewPager (nunca se desmonta Diagrama
// mientras se mira Plano, o viceversa): el estado interno de cada uno
// (zoom del plano, selección del diagrama) sobrevive al cambiar.
export default function SubTabs({ paneles, activo, onCambiar }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {paneles.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onCambiar(i)}
            style={{
              padding: "7px 16px",
              borderRadius: 3,
              border: `1px solid ${i === activo ? colores.copper : colores.border}`,
              background: i === activo ? colores.copper : "transparent",
              color: i === activo ? colores.textSobreAcento : colores.textDim,
              fontWeight: 700,
              fontSize: 12.5,
              cursor: "pointer",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "flex-start", transform: `translateX(-${activo * 100}%)`, transition: "transform 0.2s ease" }}>
          {paneles.map((p) => (
            <div key={p.id} style={{ flex: "0 0 100%", minWidth: 0, overflow: "hidden" }}>
              {p.contenido}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
