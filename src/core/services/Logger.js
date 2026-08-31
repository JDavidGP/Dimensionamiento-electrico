/**
 * Logger compartido — registro de errores y diagnósticos.
 * No realiza cálculos ni conoce módulos de dominio.
 */
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

let minLevel = LEVELS.debug;
const buffer = [];
const MAX_BUFFER = 200;

function push(level, message, meta) {
  if (LEVELS[level] < minLevel) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    meta: meta ?? null,
  };
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.shift();
  // eslint-disable-next-line no-console
  const fn = console[level] || console.log;
  if (meta != null) fn(`[${level}] ${message}`, meta);
  else fn(`[${level}] ${message}`);
}

export const Logger = {
  setLevel(level) {
    if (level in LEVELS) minLevel = LEVELS[level];
  },
  debug: (msg, meta) => push("debug", msg, meta),
  info: (msg, meta) => push("info", msg, meta),
  warn: (msg, meta) => push("warn", msg, meta),
  error: (msg, meta) => push("error", msg, meta),
  getBuffer: () => [...buffer],
  clear: () => {
    buffer.length = 0;
  },
};
