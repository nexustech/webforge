// The few web-standard globals the commands use, which the renderer and Node both have: the
// package has neither DOM nor Node types, being for either.
declare global {
  function setTimeout(callback: () => void, ms: number): unknown;
  function clearTimeout(id: unknown): void;
  function structuredClone<T>(value: T): T;
  class AbortSignal {
    readonly aborted: boolean;
    addEventListener(type: "abort", listener: () => void): void;
  }
  class AbortController {
    readonly signal: AbortSignal;
    abort(): void;
  }
}

export {};
