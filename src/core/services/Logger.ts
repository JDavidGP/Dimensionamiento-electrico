/**
 * Logger compartido — registro de errores y diagnósticos.
 * No realiza cálculos ni conoce módulos de dominio.
 */
type Nivel = "debug" | "info" | "warn" | "error";

export interface EntradaLog {
  ts: string;
  level: Nivel;
  message: string;
  meta: unknown | null;
}

const LEVELS: Record<Nivel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

let minLevel: number = LEVELS.debug;
const buffer: EntradaLog[] = [];
const MAX_BUFFER = 200;

function push(level: Nivel, message: string, meta?: unknown): void {
  if (LEVELS[level] < minLevel) return;
  const entry: EntradaLog = {
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
  setLevel(level: string): void {
    if (level in LEVELS) minLevel = LEVELS[level as Nivel];
  },
  debug: (msg: string, meta?: unknown) => push("debug", msg, meta),
  info: (msg: string, meta?: unknown) => push("info", msg, meta),
  warn: (msg: string, meta?: unknown) => push("warn", msg, meta),
  error: (msg: string, meta?: unknown) => push("error", msg, meta),
  getBuffer: (): EntradaLog[] => [...buffer],
  clear: (): void => {
    buffer.length = 0;
  },
};
