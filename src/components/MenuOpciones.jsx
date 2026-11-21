import React, { useState } from "react";
import { colores, fuentes } from "../styles/colores";
import ToggleTema from "./ToggleTema";

/**
 * Menú de 3 puntos (⋮) en la esquina superior: Ajustes, Ayuda, y acceso
 * directo al aviso de responsabilidad / privacidad (contenido ya en
 * PiePagina, no se duplica aquí).
 */
export default function MenuOpciones({ umbralDesbalanceFasesPct, setUmbralDesbalanceFasesPct }) {
  const [abierto, setAbierto] = useState(false);
  const [panel, setPanel] = useState(null); // null | "ajustes" | "ayuda"

  function irAPiePagina() {
    setAbierto(false);
    document.getElementById("pie-pagina")?.scrollIntoView({ behavior: "smooth" });
  }

  const botonMenu = {
    width: 32,
    height: 32,
    borderRadius: 6,
    border: `1px solid ${colores.border}`,
    background: colores.panel,
    color: colores.textMain,
    fontSize: 18,
    lineHeight: 1,
    cursor: "pointer",
  };

  const itemMenu = {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "8px 14px",
    background: "transparent",
    border: "none",
    color: colores.textMain,
    fontSize: 13,
    fontFamily: fuentes.display,
    cursor: "pointer",
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        aria-label="Abrir menú de opciones"
        aria-haspopup="true"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        style={botonMenu}
      >
        ⋮
      </button>

      {abierto && (
        <div
          style={{
            position: "absolute",
            top: 38,
            right: 0,
            minWidth: 190,
            background: colores.panel,
            border: `1px solid ${colores.border}`,
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
            zIndex: 20,
            overflow: "hidden",
          }}
        >
          <button type="button" style={itemMenu} onClick={() => { setPanel("ajustes"); setAbierto(false); }}>
            Ajustes
          </button>
          <button type="button" style={itemMenu} onClick={() => { setPanel("ayuda"); setAbierto(false); }}>
            Ayuda
          </button>
          <button type="button" style={itemMenu} onClick={irAPiePagina}>
            Privacidad y responsabilidad
          </button>
        </div>
      )}

      {panel && (
        <PanelModal titulo={panel === "ajustes" ? "Ajustes" : "Ayuda"} onCerrar={() => setPanel(null)}>
          {panel === "ajustes" ? (
            <PanelAjustes
              umbralDesbalanceFasesPct={umbralDesbalanceFasesPct}
              setUmbralDesbalanceFasesPct={setUmbralDesbalanceFasesPct}
            />
          ) : (
            <PanelAyuda />
          )}
        </PanelModal>
      )}
    </div>
  );
}

function PanelModal({ titulo, children, onCerrar }) {
  return (
    <div
      role="presentation"
      onClick={onCerrar}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 30,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colores.panel,
          border: `1px solid ${colores.border}`,
          borderRadius: 10,
          padding: 20,
          width: "min(460px, calc(100vw - 48px))",
          maxHeight: "calc(100vh - 80px)",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <h2 style={{ fontFamily: fuentes.condensada, fontSize: 16, margin: 0, color: colores.textMain }}>{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            style={{ background: "transparent", border: "none", color: colores.textDim, fontSize: 16, cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PanelAjustes({ umbralDesbalanceFasesPct, setUmbralDesbalanceFasesPct }) {
  const parrafo = { color: colores.textDim, fontSize: 12.5, lineHeight: 1.5, margin: "0 0 12px 0" };
  return (
    <div>
      <ToggleTema />
      <div style={{ borderTop: `1px solid ${colores.border}`, margin: "4px 0 16px 0" }} />
      <label style={{ display: "block", fontSize: 13, color: colores.textMain, marginBottom: 6 }}>
        Umbral de desbalance de fases (%)
      </label>
      <input
        type="number"
        min="1"
        step="0.5"
        value={umbralDesbalanceFasesPct}
        onChange={(e) => setUmbralDesbalanceFasesPct(e.target.value)}
        style={{
          width: 100,
          padding: "6px 8px",
          borderRadius: 6,
          border: `1px solid ${colores.border}`,
          background: colores.bg,
          color: colores.textMain,
          fontFamily: fuentes.mono,
          marginBottom: 12,
        }}
      />
      <p style={parrafo}>
        Recomendado: <strong style={{ color: colores.textMain }}>10%</strong>, según IEEE Std 141 y NEMA MG-1 (un
        desbalance de tensión del 5% ya deratea un motor trifásico a ~75% de su capacidad). Subir este valor por
        encima de 10% genera una advertencia en los resultados de balance de fases del tablero.
      </p>
      <p style={parrafo}>
        Nota: este ajuste ya alimenta el cálculo de balance de fases, pero su resultado todavía no tiene una vista
        propia en pantalla — está pendiente conectar las líneas del circuito/alimentador y mostrar aquí el
        porcentaje resultante por tablero.
      </p>
    </div>
  );
}

function PanelAyuda() {
  const parrafo = { color: colores.textDim, fontSize: 12.5, lineHeight: 1.5, margin: "0 0 10px 0" };
  const titulo = { fontFamily: fuentes.condensada, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", color: colores.copper, margin: "14px 0 6px 0" };
  return (
    <div>
      <p style={parrafo}>Flujo básico de uso:</p>
      <ol style={{ ...parrafo, paddingLeft: 18, margin: 0 }}>
        <li>Elige la normativa aplicable (NEC, CIEN, REBT...).</li>
        <li>Crea los tableros necesarios (con su alimentador y, si aplica, subtableros).</li>
        <li>Agrega los circuitos y, dentro de cada uno, sus equipos.</li>
        <li>Asigna cada circuito a su tablero correspondiente.</li>
        <li>Revisa los resultados, el breaker sugerido y las advertencias.</li>
      </ol>
      <p style={titulo}>Colores del punto de estado</p>
      <p style={parrafo}>
        <span style={{ color: colores.ok }}>●</span> correcto · <span style={{ color: colores.warn }}>●</span>{" "}
        advertencia (revisar) · <span style={{ color: colores.error }}>●</span> error (dato faltante o inválido).
      </p>
      <p style={parrafo}>
        Para el aviso de responsabilidad legal y la nota de privacidad, ver el pie de página de la aplicación (menú
        → "Privacidad y responsabilidad").
      </p>
    </div>
  );
}
