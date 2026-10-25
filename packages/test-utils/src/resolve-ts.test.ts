import type { ResolveHookContext } from "node:module";
import { describe, expect, it, vi } from "vitest";
import { resolveTs } from "./resolve-ts.js";

const context = { conditions: [], importAttributes: {} } as unknown as ResolveHookContext;

/** Resolves only the specifiers in `files`, as if they were the files on disk. */
const resolvingOnly = (...files: string[]) =>
  vi.fn((specifier: string) => {
    if (!files.includes(specifier)) throw new Error(`Cannot find module '${specifier}'`);
    return { url: `file:///src/${specifier.replace("./", "")}`, shortCircuit: true };
  });

describe("resolveTs", () => {
  it("falls back to the .ts file next to a relative .js import that isn't there", () => {
    const next = resolvingOnly("./store-import.ts");

    expect(resolveTs("./store-import.js", context, next).url).toBe("file:///src/store-import.ts");
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("keeps a .js file that is there, and leaves packages and other files alone", () => {
    const next = resolvingOnly("./bundle.js", "zod", "./data.json");

    expect(resolveTs("./bundle.js", context, next).url).toBe("file:///src/bundle.js");
    expect(resolveTs("zod", context, next).url).toBe("file:///src/zod");
    expect(resolveTs("./data.json", context, next).url).toBe("file:///src/data.json");
    expect(() => resolveTs("other-package/index.js", context, next)).toThrow();
  });
});
