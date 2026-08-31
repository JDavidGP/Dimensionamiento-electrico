/**
 * Cache en memoria para tablas normativas y resultados frecuentes.
 */
const store = new Map();

export const Cache = {
  get(key) {
    return store.has(key) ? store.get(key) : undefined;
  },
  set(key, value, ttlMs = 0) {
    store.set(key, value);
    if (ttlMs > 0) {
      setTimeout(() => store.delete(key), ttlMs);
    }
  },
  has(key) {
    return store.has(key);
  },
  delete(key) {
    store.delete(key);
  },
  clear() {
    store.clear();
  },
  keys() {
    return [...store.keys()];
  },
};
