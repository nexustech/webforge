import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** The site components' package, where Node resolves the package's own name. */
const PACKAGE = join(import.meta.dirname, "../../packages/site-components");

/**
 * Imports `@webforge/site-components/schema` in plain Node, as a tool would, recording every
 * module it asks for; prints them as JSON.
 */
const IMPORT_SCHEMA = `
import { registerHooks } from "node:module";
const asked = [];
registerHooks({
  resolve(specifier, context, next) {
    asked.push(specifier);
    return next(specifier, context);
  },
});
await import("@webforge/site-components/schema");
console.log(JSON.stringify(asked));
`;

describe("@webforge/site-components/schema (R7)", () => {
  it("loads in plain Node, without React or Vite", () => {
    const run = spawnSync(process.execPath, ["--input-type=module", "-e", IMPORT_SCHEMA], {
      cwd: PACKAGE,
      encoding: "utf8",
    });

    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
    const asked = JSON.parse(run.stdout) as string[];
    expect(asked).toContain("@webforge/site-components/schema");
    expect(asked.filter((specifier) => /react|vite/.test(specifier))).toEqual([]);
  });
});
