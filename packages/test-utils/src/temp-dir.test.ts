import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

// Watched, to see how the folders are removed (#1353); each call still goes to Node's own.
const removed = vi.hoisted(() => ({ options: [] as unknown[] }));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    rmSync: (
      path: Parameters<typeof actual.rmSync>[0],
      options: Parameters<typeof actual.rmSync>[1],
    ) => {
      removed.options.push(options);
      actual.rmSync(path, options);
    },
  };
});

const { TEST_DIR_REMOVAL, tempDirFactory } = await import("./temp-dir.js");

describe("tempDirFactory", () => {
  const tempDir = tempDirFactory("webforge-temp-dir-test-");
  let previous = "";

  it("creates a new directory with the prefix", () => {
    previous = tempDir();

    expect(existsSync(previous)).toBe(true);
    expect(previous).toContain("webforge-temp-dir-test-");
  });

  it("deletes the directories of the previous test, trying again as Windows may refuse a moment (#1353)", () => {
    expect(existsSync(previous)).toBe(false);
    expect(removed.options).toEqual([TEST_DIR_REMOVAL]);
    expect(TEST_DIR_REMOVAL).toMatchObject({ recursive: true, force: true });
    expect(TEST_DIR_REMOVAL.maxRetries).toBeGreaterThan(0);
    expect(TEST_DIR_REMOVAL.retryDelay).toBeGreaterThan(0);
  });
});
