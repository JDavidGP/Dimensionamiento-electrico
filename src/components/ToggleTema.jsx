import React, { useState } from "react";
import { colores, fuentes } from "../styles/colores";

const CLAVE_LOCALSTORAGE = "dec-tema";

// Mismo patrón de persistencia que el script inline de index.html (que
// aplica el tema ANTES de pintar, para no mostrar un parpadeo) — ver
// su comentario para el porqué. localStorage puede fallar (modo
// privado, storage bloqueado) — nunca debe romper el toggle, solo
// perder la persistencia entre visitas.
function leerTemaGuardado() {
  try {
    return localStorage.getItem(CLAVE_LOCALSTORAGE);
  } catch {
    return null;
  }
}

function aplicarTema(tema) {
  if (tema) {
    document.documentElement.setAttribute("data-tema", tema);
  } else {
    document.documentElement.removeAttribute("data-tema"); // "Automático": cae al prefers-color-scheme del sistema
  }
  try {
    if (tema) localStorage.setItem(CLAVE_LOCALSTORAGE, tema);
    else localStorage.removeItem(CLAVE_LOCALSTORAGE);
  } catch {
    // sin persistencia (modo privado, storage bloqueado) — el toggle sigue funcionando para esta sesión
  }
}

/** Alterna entre los 2 temas que propuso el usuario ("Claro Profesional"/"Sendero de Musgo", ver src/styles/temas.css) o "Automático" (sigue al sistema). */
export default function ToggleTema() {
  const [tema, setTema] = useState(() => leerTemaGuardado());

  function elegir(nuevoTema) {
    setTema(nuevoTema);
    aplicarTema(nuevoTema);
  }

  const opciones = [
    { valor: null, etiqueta: "Automático" },
    { valor: "claro", etiqueta: "Claro" },
    { valor: "musgo", etiqueta: "Oscuro" },
  ];

  return (
    <div>
      <label style={{ display: "block", fontSize: 13, color: colores.textMain, marginBottom: 6 }}>Tema de color</label>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {opciones.map((o) => (
          <button
            key={o.etiqueta}
            type="button"
            onClick={() => elegir(o.valor)}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: `1px solid ${tema === o.valor ? colores.copper : colores.border}`,
              background: tema === o.valor ? colores.copper : "transparent",
              color: tema === o.valor ? "#fff" : colores.textDim,
              fontFamily: fuentes.display,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {o.etiqueta}
          </button>
        ))}
      </div>
    </div>
  );
}
