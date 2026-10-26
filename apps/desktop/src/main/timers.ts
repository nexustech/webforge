/** Timeouts, injectable so tests can use fake ones. */
export type Timers = {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

/** The real timeouts. */
export const defaultTimers: Timers = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};
