// Paleta central — cambiar aquí se refleja en toda la app.
export const colores = {
  bg: "#171512",
  panel: "#211E1A",
  border: "#3A352C",
  copper: "#C9793D",
  copperDim: "#8A5A30",
  textMain: "#EDE7DC",
  textDim: "#96907F",
  ok: "#7FA66B",
  warn: "#D9A441",
  // Contraste ≥ 4,5:1 (WCAG AA) sobre bg (5,5:1) y panel (5,0:1).
  // El anterior #C1543C daba 3,6:1 sobre panel, insuficiente para texto pequeño.
  error: "#DE6B50",
};

// Fuentes del sistema: la app no carga nada de servidores externos
// (antes se usaba el CDN de Google Fonts, que envía la IP del visitante a Google).
// Si se instalan las fuentes localmente (p. ej. @fontsource/ibm-plex-sans),
// se usarán primero; si no, se cae a la fuente nativa del sistema.
export const fuentes = {
  display: '"IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  condensada: '"IBM Plex Sans Condensed", "Arial Narrow", ui-sans-serif, system-ui, sans-serif',
};
