import { join } from "node:path";
import { createSite } from "@webforge/model";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import { describe, expect, it } from "vitest";
import { ProjectStore, type WriteParts } from "../src/index.js";

// Each committed write's time in two parts (#1621), for the E2E tests' step timings: the work
// inside its transaction, and BEGIN and COMMIT, whose fsync is the disk's flush.

const tempDir = tempDirFactory("webforge-timed-write-");

/** A new site's file at a fresh path, opened with a timer that keeps every write's parts. */
function openTimed() {
  const path = join(tempDir(), "Bakery.wforge");
  const made = ProjectStore.create(path, { name: "Bakery" });
  made.close();
  const parts: WriteParts[] = [];
  const store = ProjectStore.open(path, { timedWrite: (each) => parts.push(each) });
  return { store, parts };
}

const site = createSite({
  name: "Bakery",
  language: "en",
  homeTitle: "Home",
  notFoundTitle: "404",
});

describe("a write's two parts (#1621)", () => {
  it("tells each committed write's changes and flush, once each", () => {
    const { store, parts } = openTimed();
    try {
      const start = performance.now();
      store.saveSite(site);
      const total = performance.now() - start;

      expect(parts).toHaveLength(1);
      const [write] = parts;
      expect(write?.changesMs).toBeGreaterThan(0);
      expect(write?.flushMs).toBeGreaterThanOrEqual(0);
      expect((write?.changesMs ?? 0) + (write?.flushMs ?? 0)).toBeLessThanOrEqual(total + 1);

      store.commit([]);
      store.saveSite(site);
      expect(parts).toHaveLength(3);
    } finally {
      store.close();
    }
  });

  it("tells nothing of a write that fails, which committed nothing", () => {
    const { store, parts } = openTimed();
    try {
      expect(() =>
        store.commit([{ type: "put", id: "site", kind: "site", content: { broken: 1n } }]),
      ).toThrow();
      expect(parts).toEqual([]);
    } finally {
      store.close();
    }
  });
});
