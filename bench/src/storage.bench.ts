import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { changedDocuments, type SiteDoc } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { describe, test } from "vitest";
import { measure } from "./measure.js";
import { homeOf, largeSite, PAGES } from "./sites.js";

// Autosave's commit (architecture §10: < 50 ms, off the UI thread; ADR 0003): one changed page of
// a 20-page site, written to its file in one transaction, as the storage writer commits it.

describe(`autosave, a site of ${PAGES} large pages (§10)`, () => {
  test("commit one changed page", async ({ bench }) => {
    const dir = mkdtempSync(join(tmpdir(), "webforge-bench-"));
    const store = ProjectStore.create(join(dir, "Large.wforge"), { name: "Large" });
    try {
      let site: SiteDoc = largeSite();
      store.saveSite(site);
      let edit = 0;
      await measure(
        bench,
        "autosave-commit",
        () => {
          edit += 1;
          const next: SiteDoc = {
            ...site,
            pages: {
              ...site.pages,
              [site.homePageId]: { ...homeOf(site), title: `Home ${edit}` },
            },
          };
          store.commit(changedDocuments(site, next));
          site = next;
        },
        { budgetMs: 50 },
      );
    } finally {
      store.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
