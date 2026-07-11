/* eslint-disable */
export const api = new Proxy({}, {
  get(_, mod) {
    return new Proxy({}, { get(_, fn) { return `${String(mod)}:${String(fn)}`; } });
  }
});
export const internal = new Proxy({}, {
  get(_, mod) {
    return new Proxy({}, { get(_, fn) { return `${String(mod)}:${String(fn)}`; } });
  }
});
