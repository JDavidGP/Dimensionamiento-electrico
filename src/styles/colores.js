// Paleta central — usuario, 2026-11-22 ("cambia el tema a los que yo
// sugerí"): los valores reales de cada rol ya NO viven acá, viven como
// variables CSS en src/styles/temas.css (2 temas: "claro"/"musgo",
// alternables en vivo — ver ToggleTema.jsx). Esto solo mapea cada rol
// de siempre a su variable, así ningún componente de los ~40 que usan
// `colores.X` necesitó cambiar una sola línea para que el toggle de
// tema les llegue — `var(--x)` funciona igual en `style={{}}` y en
// atributos SVG planos (`fill="var(--ok)"`), confirmado antes de
// hacer el cambio.
export const colores = {
  bg: "var(--bg)",
  panel: "var(--panel)",
  border: "var(--border)",
  copper: "var(--copper)",
  copperDim: "var(--copper-dim)",
  textMain: "var(--text-main)",
  textDim: "var(--text-dim)",
  ok: "var(--ok)",
  warn: "var(--warn)",
  error: "var(--error)",
  // Fondos/bordes semitransparentes para avisos — antes se armaban a
  // mano en cada componente concatenando un sufijo de alpha en hex
  // (`${colores.error}14`), que dejó de poder funcionar al pasar
  // `colores.error` a ser una referencia `var(--error)` en vez de un
  // hex literal. Mismos 2 niveles de alpha de siempre (hex 14≈8%, 44≈27%).
  copperFondo: "var(--copper-a14)",
  errorFondo: "var(--error-a14)",
  errorBorde: "var(--error-a44)",
  okFondo: "var(--ok-a14)",
  // Texto sobre un fondo lleno de copper/warn (botones primarios,
  // tabs activas) — antes hardcodeado "#171512" en ~30 lugares,
  // porque coincidía con el bg oscuro de siempre y daba buen
  // contraste contra el copper VIEJO (#C9793D, 5,45:1). El nuevo
  // acento (#6c4b6c, de la paleta que pidió el usuario) es mucho más
  // oscuro: "#171512" cae a 2,48:1 contra él (no pasa WCAG AA ni para
  // texto grande) — texto blanco da 7,34:1. Mismo blanco funciona
  // bien contra warn (4,68:1) en los 2 casos que lo usan. NO usar
  // contra `colores.ok` (un blanco ahí da solo 2,47:1 — ese caso
  // puntual sigue con texto oscuro, ok es claro en ambos temas).
  textSobreAcento: "#fff",
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
