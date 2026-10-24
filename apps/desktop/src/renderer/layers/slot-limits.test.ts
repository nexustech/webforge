import type { NodeDoc } from "@webforge/model";
import { MAX_COLUMNS } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { currentPage } from "../editor/editor-session.js";
import { copyLayer } from "../editor/layers.js";
import { starterSite } from "../editor/starter-site.js";
import { sessionWith } from "../testing/fixtures.js";
import { duplicateSelected } from "./bulk-layers.js";

// A Columns holds four columns at most (2.9, slot `max`): duplicate and a copy-drag in Layers
// refuse a fifth, changing nothing, as the Add panel, paste and the canvas do.

const column = (id: string): NodeDoc => ({ type: "Column", props: { id, content: [] } });

/** A page whose Section holds a full Columns ("full") and one with room ("room"). */
function setUp() {
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
});
