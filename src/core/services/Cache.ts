/**
 * Cache en memoria para tablas normativas y resultados frecuentes.
 */
const store = new Map<string, unknown>();

export const Cache = {
  get<T = unknown>(key: string): T | undefined {
    return store.has(key) ? (store.get(key) as T) : undefined;
  },
  set(key: string, value: unknown, ttlMs = 0): void {
    store.set(key, value);
    if (ttlMs > 0) {
      setTimeout(() => store.delete(key), ttlMs);
    }
  },
  has(key: string): boolean {
    return store.has(key);
  },
  delete(key: string): void {
    store.delete(key);
  },
  clear(): void {
    store.clear();
  },
  keys(): string[] {
    return [...store.keys()];
  },
};
