import { createHistoryManager } from "@webforge/history";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { siteDocArbitrary } from "../test/arbitraries.js";
import type { PageId } from "./ids.js";
import type { SiteDoc } from "./site-doc.js";
import { changedDocuments, pageDocumentId, restoreSite } from "./site-documents.js";

// restoreSite (#664, for 4.6's Restore): a version replaces the site in one history step, and only
// the documents that differ change.

/** `site` in a history, restored to `target` in one step. */
function restored(site: SiteDoc, target: SiteDoc) {
  const history = createHistoryManager({ initial: site });
  history.run("Restored version", (draft) => restoreSite(draft, target));
  return history;
}

describe("restoreSite (#664)", () => {
  it("gives the version, as one undo step that Undo takes back whole", () => {
    fc.assert(
      fc.property(siteDocArbitrary, siteDocArbitrary, (site, version) => {
        const history = restored(site, version);
        expect(history.document.getState()).toEqual(version);
        expect(history.state.getState().entries.length).toBeLessThanOrEqual(1);

        history.undo();
        expect(history.document.getState()).toEqual(site);
      }),
    );
  });

  it("changes only the page that differs: one document to save", () => {
    fc.assert(
      fc.property(siteDocArbitrary, fc.nat(), (site, which) => {
        const id = site.pageOrder[which % site.pageOrder.length] as PageId;
        const page = site.pages[id];
        if (page === undefined) return;
        const version = structuredClone(site);
        version.pages[id] = { ...structuredClone(page), title: `${page.title} (before)` };

        const history = restored(site, version);
        const after = history.document.getState();

        expect(history.state.getState().entries).toHaveLength(1);
        expect(changedDocuments(site, after)).toEqual([
          { type: "put", id: pageDocumentId(id), kind: "page", content: after.pages[id] },
        ]);
        expect(after.theme).toBe(site.theme);
      }),
    );
  });

  it("changes nothing when the version is the site as it is, keys in another order", () => {
    fc.assert(
      fc.property(siteDocArbitrary, (site) => {
        // A version read back from the file: the same JSON, its keys in the order it was parsed.
        const { settings, ...rest } = structuredClone(site);
        const history = restored(site, { settings, ...rest });

        expect(history.state.getState().entries).toEqual([]);
        expect(history.document.getState()).toBe(site);
      }),
    );
  });
});
