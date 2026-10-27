import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** The modules `index.ts` re-exports, and those they import in turn, within this package. */
function rootModules(): string[] {
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    for (const [, path] of source.matchAll(/from "(\.\/[^"]+)\.js"/g)) visit(`${path}.ts`);
  };
  visit("./index.ts");
  return [...seen];
}

describe("@webforge/test-utils's root entry (#539)", () => {
  it("never loads Vitest, so Playwright's e2e can import it: Vitest's helpers are at /vitest", () => {
    for (const file of rootModules()) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(source, file).not.toMatch(/from "vitest"/);
    }
  });
});
