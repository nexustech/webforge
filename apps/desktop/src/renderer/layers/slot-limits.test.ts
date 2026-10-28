import type { NodeDoc } from "@webforge/model";
import { MAX_COLUMNS } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { duplicateSelected } from "../editor/bulk-layers.js";
import { currentPage } from "../editor/editor-session.js";
import { copyLayer } from "../editor/layers.js";
import { sessionWith } from "../testing/fixtures.js";

// A Columns holds four columns at most (2.9, slot `max`): duplicate and a copy-drag in Layers
// refuse a fifth, changing nothing, as the Add panel, paste and the canvas do.

const column = (id: string): NodeDoc => ({ type: "Column", props: { id, content: [] } });

/**
 * A page whose Section holds a full Columns ("full") and one with room ("room"), and with
 * `over`, one of five before them, as an old file might hold (#375).
 */
function setUp({ over = false } = {}) {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  const full = Array.from({ length: MAX_COLUMNS }, (_, index) => column(`f${index}`));
  const content: NodeDoc[] = [
    {
      type: "Section",
      props: {
        id: "s",
        content: [
          ...(over
            ? [
                {
                  type: "Columns",
                  props: {
                    id: "over",
                    columns: Array.from({ length: MAX_COLUMNS + 1 }, (_, index) =>
                      column(`o${index}`),
                    ),
                  },
                },
              ]
            : []),
          { type: "Columns", props: { id: "full", columns: full } },
          { type: "Columns", props: { id: "room", columns: [column("r0")] } },
        ],
      },
    },
  ];
  const session = sessionWith({
    ...site,
    pages: { ...site.pages, [home.id]: { ...home, doc: { root: { props: {} }, content } } },
  });
  const count = (id: string) => {
    const section = currentPage(session)?.doc.content[0]?.props.content as NodeDoc[] | undefined;
    const columns = section?.find((node) => node.props.id === id)?.props.columns;
    return Array.isArray(columns) ? columns.length : 0;
  };
  return { session, count };
}

describe("a Columns' four columns (2.9)", () => {
  it("refuses to duplicate a column of a full Columns, and says why", () => {
    const { session, count } = setUp();
    session.select("f0");

    expect(duplicateSelected(session)).toEqual({
      refused: "There's no room for another there: a Columns holds at most four columns.",
    });
    expect(count("full")).toBe(MAX_COLUMNS);
    expect(session.history.entries()).toEqual([]);

    session.select("r0");
    expect(duplicateSelected(session)).toEqual({});
    expect(count("room")).toBe(2);
  });

  it("copies no column by dragging in Layers into a full Columns", () => {
    const { session, count } = setUp();

    copyLayer(session, "f0", 1, false);

    expect(count("full")).toBe(MAX_COLUMNS);
    expect(session.history.entries()).toEqual([]);
    copyLayer(session, "r0", 1, false);
    expect(count("room")).toBe(2);
  });

  it("keeps to the limit on a page with a Columns over it elsewhere (#375)", () => {
    const { session, count } = setUp({ over: true });

    session.select("f0");
    expect(duplicateSelected(session)).toEqual({
      refused: "There's no room for another there: a Columns holds at most four columns.",
    });
    copyLayer(session, "f0", 1, false);
    expect(count("full")).toBe(MAX_COLUMNS);
    // Nor one more in the Columns already over it.
    session.select("o0");
    expect(duplicateSelected(session)).toHaveProperty("refused");
    expect(count("over")).toBe(MAX_COLUMNS + 1);
    expect(session.history.entries()).toEqual([]);

    // Where there is room, as before.
    session.select("r0");
    expect(duplicateSelected(session)).toEqual({});
    expect(count("room")).toBe(2);
  });

  it("says why a copy-drag is refused, as duplicate does (#384)", () => {
    const { session, count } = setUp();

    expect(copyLayer(session, "f0", 1, false)).toBe(
      "There's no room for another there: a Columns holds at most four columns.",
    );
    expect(count("full")).toBe(MAX_COLUMNS);
  });

  it("says a copy that holds a Columns over the limit itself must lose a column first (#384)", () => {
    const { session } = setUp({ over: true });
    const overfull =
      "What you're copying holds a Columns with more than four columns. Remove one first, then copy it.";

    // The Section holding the Columns of five: there's room for it, but it's over the limit.
    session.select("s");
    expect(duplicateSelected(session)).toEqual({ refused: overfull });
    expect(copyLayer(session, "s", 1, false)).toBe(overfull);
    expect(session.history.entries()).toEqual([]);
  });
});
