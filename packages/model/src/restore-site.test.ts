import fc from "fast-check";
import { applyPatches, enablePatches, produceWithPatches } from "immer";
import { describe, expect, it } from "vitest";
import { siteDocArbitrary } from "../test/arbitraries.js";
import type { PageId } from "./ids.js";
import type { SiteDoc } from "./site-doc.js";
import { changedDocuments, pageDocumentId, restoreSite } from "./site-documents.js";

// restoreSite (#664, for 4.6's Restore): a version replaces the site in one history step, and only
// the documents that differ change. The step is made as the history makes one (Immer, with its
// patches); the editor's own test of a restore is in page-updated.test.ts.

enablePatches();

/** A copy of `value`, as the file gives a version back: JSON. */
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** `site` restored to `target` in one step, as the history records it: the site after, and Undo. */
function restored(site: SiteDoc, target: SiteDoc) {
  const [after, forward, inverse] = produceWithPatches(site, (draft) => {
    restoreSite(draft, target);
  });
  return { after, changed: forward.length > 0, undo: () => applyPatches(after, inverse) };
}

describe("restoreSite (#664)", () => {
  it("gives the version in one step, which Undo takes back whole", () => {
    fc.assert(
      fc.property(siteDocArbitrary, siteDocArbitrary, (site, version) => {
        const restore = restored(site, version);
        expect(restore.after).toEqual(version);

        expect(restore.undo()).toEqual(site);
      }),
    );
  });

  it("changes only the page that differs: one document to save", () => {
    fc.assert(
      fc.property(siteDocArbitrary, fc.nat(), (site, which) => {
        const id = site.pageOrder[which % site.pageOrder.length] as PageId;
        const page = site.pages[id];
        if (page === undefined) return;
        const version = copy(site);
        version.pages[id] = { ...copy(page), title: `${page.title} (before)` };

        const { after, changed } = restored(site, version);

        expect(changed).toBe(true);
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
        const { settings, ...rest } = copy(site);
        const restore = restored(site, { settings, ...rest });

        // No step at all: the history records none.
        expect(restore.changed).toBe(false);
        expect(restore.after).toBe(site);
      }),
    );
  });
});
