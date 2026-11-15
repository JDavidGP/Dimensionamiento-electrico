import React from "react";
import { colores, fuentes } from "../styles/colores";

// Pie de página con el aviso de responsabilidad, la nota de privacidad
// y los datos de autoría. Se muestra siempre, en todas las vistas.
export default function PiePagina() {
  const titulo = {
    fontFamily: fuentes.condensada,
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: colores.warn,
    margin: "0 0 6px 0",
  };
  const parrafo = { color: colores.textDim, fontSize: 12.5, lineHeight: 1.55, margin: "0 0 14px 0", maxWidth: 900 };

  return (
    <footer
      style={{ borderTop: `1px solid ${colores.border}`, padding: "20px 24px 28px 24px", background: colores.panel }}
    >
      <section aria-labelledby="aviso-responsabilidad">
        <h2 id="aviso-responsabilidad" style={titulo}>
          Aviso de responsabilidad
        </h2>
        <p style={parrafo}>
          Los resultados de esta aplicación son <strong style={{ color: colores.textMain }}>orientativos</strong> y
          sirven como apoyo al cálculo. No sustituyen la consulta del texto oficial de cada normativa (NEC, CIEN,
          REBT / UNE-HD 60364) ni el criterio de un profesional habilitado. Antes de ejecutar cualquier instalación,
          un técnico o ingeniero competente debe verificar los cálculos y la selección de conductores, protecciones y
          canalizaciones, y tener en cuenta las condiciones reales de la obra y los requisitos de la autoridad local.
          El autor no se hace responsable de daños derivados del uso de estos resultados sin dicha verificación.
        </p>
      </section>

      <section aria-labelledby="nota-privacidad">
        <h2 id="nota-privacidad" style={titulo}>
          Privacidad
        </h2>
        <p style={parrafo}>
          Esta aplicación no pide registro, no usa cookies ni herramientas de analítica o rastreo, y no envía tus
          proyectos a ningún servidor: los cálculos se hacen en tu navegador y los proyectos se guardan solo como
          archivos JSON en tu equipo. El proveedor de alojamiento puede registrar datos técnicos de acceso (como la
          dirección IP) por motivos de seguridad y funcionamiento.
        </p>
      </section>

      <p style={{ ...parrafo, margin: 0, fontFamily: fuentes.mono, fontSize: 11.5 }}>
        © 2026 Josué David Gibson Pérez · Técnico electricista y en energías renovables · Nicaragua · Todos los
        derechos reservados.
      </p>
    </footer>
  );
}
