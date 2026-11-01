import { restoreSite } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { createEditorSession } from "./editor-session.js";
import { localDay } from "./page-updated.js";

/** A session on the starter site whose days are `2026-10-01`, `2026-10-02`… one per change. */
function setUp() {
  let day = 0;
  const session = createEditorSession(siteLibrary, starterSite(), undefined, () => {
    day += 1;
    return `2026-10-${String(day).padStart(2, "0")}`;
  });
  const home = session.history.document.getState().homePageId;
  const doc = () => session.history.document.getState();
  return { session, home, doc };
}

describe("a page's last-changed date (3.15, SEO-3)", () => {
  it("dates a page an edit changes, in the same step, and undo takes it back", () => {
    const { session, home, doc } = setUp();
    expect(doc().pages[home]?.updated).toBeUndefined();

    session.edit("props", "Renamed", (draft) => {
      const page = draft.pages[home];
      if (page !== undefined) page.title = "Welcome";
    });

    expect(doc().pages[home]?.updated).toBe("2026-10-01");
    expect(session.history.entries()).toHaveLength(1);
    session.history.undo();
    expect(doc().pages[home]).not.toHaveProperty("updated");
  });

  it("dates the pages a restored version changes, in the restore's one step (#664)", () => {
    const { session, home, doc } = setUp();
    const version = structuredClone(doc());
    const restoredPage = version.pages[home];
    if (restoredPage === undefined) throw new Error("no home page");
    restoredPage.title = "As it was";
    const other = doc().pageOrder.find((id) => id !== home);

    session.edit("root", "Restored a version", (draft) => restoreSite(draft, version));

    expect(doc().pages[home]).toMatchObject({ title: "As it was", updated: "2026-10-01" });
    expect(other === undefined ? undefined : doc().pages[other]).not.toHaveProperty("updated");
    expect(session.history.entries()).toHaveLength(1);
  });

  it("dates no page for a site-wide change: the theme, Header and Footer, shared sections", () => {
    const { session, doc } = setUp();

    session.edit("props", "Theme", (draft) => {
      draft.theme.shadow = "strong";
    });
    session.edit("props", "Footer", (draft) => {
      draft.layout.footer = [];
    });

    for (const page of Object.values(doc().pages)) {
      expect(page, page.title).not.toHaveProperty("updated");
    }
  });

  it("is today on this computer, as the format writes a day", () => {
    expect(localDay(new Date(2026, 9, 28, 23, 59))).toBe("2026-10-28");
    expect(localDay(new Date(2027, 0, 5))).toBe("2027-01-05");
  });

  it("leaves every page's date as it was when its changes are undone (fast-check)", () => {
    const edits = fc.array(
      fc.oneof(
        fc.record({ kind: fc.constant("title" as const), text: fc.string({ maxLength: 8 }) }),
        fc.record({ kind: fc.constant("theme" as const), strong: fc.boolean() }),
        fc.record({ kind: fc.constant("undo" as const) }),
      ),
      { maxLength: 12 },
    );
    fc.assert(
      fc.property(edits, (steps) => {
        const { session, home, doc } = setUp();
        const before: unknown[] = [];
        for (const step of steps) {
          if (step.kind === "undo") {
            const expected = before.pop();
            if (session.history.undo()) {
              expect(doc().pages[home]?.updated).toBe(expected);
            }
            continue;
          }
          const was = doc().pages[home]?.updated;
          // Where the history stands: a step after an undo replaces the undone one.
          const cursor = session.history.state.getState().cursor;
          session.edit("props", step.kind, (draft) => {
            if (step.kind === "title") {
              const page = draft.pages[home];
              if (page !== undefined) page.title = `Home ${step.text}`;
            } else {
              draft.theme.shadow = step.strong ? "strong" : "soft";
            }
          });
          if (session.history.state.getState().cursor > cursor) before.push(was);
        }
        // Undoing everything leaves the page as it started: never dated.
        while (session.history.undo()) {
          // until the start
        }
        expect(doc().pages[home]).not.toHaveProperty("updated");
      }),
    );
  });
});
