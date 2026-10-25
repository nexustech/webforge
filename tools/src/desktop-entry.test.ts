import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The desktop app's entry point only hands Electron to the app's wiring (R13c): it is left out of
// the coverage, so anything it grows goes untested. The wiring belongs in app.ts, tested against
// a fake Electron.

const ENTRY = join(import.meta.dirname, "../../apps/desktop/src/main/index.ts");

describe("the desktop app's entry point (R13c)", () => {
  it("stays at 40 lines or fewer", () => {
    const lines = readFileSync(ENTRY, "utf8").trimEnd().split("\n");

    expect(lines.length).toBeLessThanOrEqual(40);
  });
});
