import { join } from "node:path";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import { describe, expect, it, vi } from "vitest";
import { ProjectStore } from "../src/index.js";

// Opening checks the whole content (#295): it hashes every document's blob and checks every
// version's manifest. This keeps that affordable on a large site: 40 pages of about 60 KB of JSON
// each (a 225-element page is about that size) and 300 saved versions.

/**
 * While the large project is built, its writes skip the journal file and fsync (#947). Built with
 * the real settings, its 600 transactions each waited for the disk: on CI's Windows runners the
 * test took 21–42 s in a week of nightly runs, and 129 s in one full run, past its timeout, while
 * opening the project never took more than 40 ms. The opens it times keep the real settings.
 */
const building = vi.hoisted(() => ({ fast: false }));
vi.mock("../src/connection.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/connection.js")>();
  return {
    ...original,
    configureWrites: (db: Parameters<typeof original.configureWrites>[0]) => {
      original.configureWrites(db);
      if (building.fast) {
        db.pragma("journal_mode = MEMORY");
        db.pragma("synchronous = OFF");
      }
    },
  };
});

const tempDir = tempDirFactory();
const PAGES = 40;
const VERSIONS = 300;
/**
 * Far above what it takes (a median of about 70 ms on a developer's Windows machine; the manifest
 * check alone took 2.4 s before it became one query), so only a real slowdown fails it.
 */
const OPEN_BUDGET_MS = 1_500;

/** A page document of about 60 KB, different for each page and each save. */
function pageContent(page: number, save: number) {
  return {
    save,
    content: Array.from({ length: 300 }, (_, index) => ({
      type: "Text",
      props: { id: `p${page}-n${index}`, text: `<p>Paragraph ${index} of page ${page}.</p>` },
    })),
  };
}

describe("opening a large project (#295)", () => {
  it("checks the content of 40 pages and 300 versions within its budget", () => {
    const path = join(tempDir(), "large.wforge");
    building.fast = true;
    const store = ProjectStore.create(path, { name: "Large" });
    for (let version = 0; version < VERSIONS; version += 1) {
      // Each save changes one page, as editing does, and keeps a version.
      store.commit(
        version === 0
          ? Array.from({ length: PAGES }, (_, page) => ({
              type: "put" as const,
              id: `page:p${page}`,
              kind: "page",
              content: pageContent(page, 0),
            }))
          : [
              {
                type: "put" as const,
                id: `page:p${version % PAGES}`,
                kind: "page",
                content: pageContent(version % PAGES, version),
              },
            ],
      );
      store.saveVersion(`Version ${version}`, "daily");
    }
    store.close();
    building.fast = false;

    const times: number[] = [];
    for (let run = 0; run < 5; run += 1) {
      const start = performance.now();
      ProjectStore.open(path).close();
      times.push(performance.now() - start);
    }
    const median = [...times].sort((a, b) => a - b)[2] ?? Number.POSITIVE_INFINITY;
    console.info(`Open of ${PAGES} pages and ${VERSIONS} versions: median ${median.toFixed(1)} ms`);
    expect(median).toBeLessThan(OPEN_BUDGET_MS);
  }, 120_000);
});
