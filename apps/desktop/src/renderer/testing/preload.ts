import { vi } from "vitest";
import type { WebforgeApi } from "../../shared/webforge-api.js";

/** What a test gives a {@link fakePreloadApi} instead of its defaults, by domain and call. */
export type PreloadOverrides = {
  readonly [Domain in keyof WebforgeApi]?: Partial<WebforgeApi[Domain]>;
};

/**
 * What `await` and Vitest's matchers look for on any object; never faked, so awaiting a domain or
 * printing one in a failed check works as for a plain object.
 */
const NOT_CALLS = new Set(["then", "toJSON", "asymmetricMatch", "$$typeof", "nodeType"]);

/**
 * The preload API (`window.webforge`) for a renderer test (2.20, B6), without Electron. A call the
 * test gives in `overrides` does what it says; any other is a `vi.fn()`: a subscription (`on…`)
 * returns its unsubscribe, every other call resolves to nothing. Each domain keeps its fakes, so a
 * test can check what was called (`api.project.commit`).
 */
export function fakePreloadApi(overrides: PreloadOverrides = {}): WebforgeApi {
  const domains = new Map<string, Record<string, unknown>>();
  const domain = (name: string): Record<string, unknown> => {
    let calls = domains.get(name);
    if (calls === undefined) {
      const given: Record<string, unknown> = { ...(overrides as Record<string, object>)[name] };
      calls = new Proxy(given, {
        get(target, call) {
          if (typeof call !== "string" || NOT_CALLS.has(call)) return target[call as string];
          if (!(call in target)) {
            target[call] = /^on[A-Z]/.test(call)
              ? vi.fn(() => () => undefined)
              : vi.fn(async () => undefined);
          }
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
