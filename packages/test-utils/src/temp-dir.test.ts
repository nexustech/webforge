import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { tempDirFactory } from "./temp-dir.js";

describe("tempDirFactory", () => {
  const tempDir = tempDirFactory("webforge-temp-dir-test-");
  let previous = "";

  it("creates a new directory with the prefix", () => {
    previous = tempDir();

    expect(existsSync(previous)).toBe(true);
    expect(previous).toContain("webforge-temp-dir-test-");
  });

  it("deletes the directories of the previous test", () => {
    expect(existsSync(previous)).toBe(false);
  });
});
