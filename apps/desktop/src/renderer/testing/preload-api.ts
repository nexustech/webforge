import type { WebforgeApi } from "../../shared/webforge-api.js";

/** What a test or story gives a fake preload API instead of its defaults, by domain and call. */
export type PreloadOverrides = {
  readonly [Domain in keyof WebforgeApi]?: Partial<WebforgeApi[Domain]>;
};

/**
 * What `await` and Vitest's matchers look for on any object; never faked, so awaiting a domain or
 * printing one in a failed check works as for a plain object.
 */
const NOT_CALLS = new Set(["then", "toJSON", "asymmetricMatch", "$$typeof", "nodeType"]);

/**
 * The preload API (`window.webforge`) without Electron (2.20, B6; #668). A call given in
 * `overrides` does what it says; any other is made by `stub` the first time it is asked for: a
 * subscription (`on…`) when `subscription` is true, else a call. Each domain keeps its calls.
 */
export function preloadApiWith(
  overrides: PreloadOverrides,
  stub: (subscription: boolean) => unknown,
): WebforgeApi {
  const domains = new Map<string, Record<string, unknown>>();
  const domain = (name: string): Record<string, unknown> => {
    let calls = domains.get(name);
    if (calls === undefined) {
      const given: Record<string, unknown> = { ...(overrides as Record<string, object>)[name] };
      calls = new Proxy(given, {
        get(target, call) {
          if (typeof call !== "string" || NOT_CALLS.has(call)) return target[call as string];
          if (!(call in target)) target[call] = stub(/^on[A-Z]/.test(call));
          return target[call];
        },
      });
      domains.set(name, calls);
    }
    return calls;
  };
  return new Proxy({} as WebforgeApi, {
    get: (_target, name) => (typeof name === "string" ? domain(name) : undefined),
  });
}
