import {
  copiedNodeId,
  isSharedCopy,
  type NodeDoc,
  SHARED_COPY_TYPE,
  type SharedSectionId,
} from "@webforge/model";
import { describe, expect, it } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { sessionWith } from "../testing/fixtures.js";
import {
  deleteSelected,
  duplicateSelected,
  moveSelected,
  similarTo,
  toggleSelectedHidden,
} from "./bulk-layers.js";
import { currentPage } from "./editor-session.js";
import { copyLayer } from "./layers.js";
import { selectedIds } from "./selection.js";

const HOURS = "shared-hours" as SharedSectionId;
const heading = (id: string, extra: Record<string, unknown> = {}): NodeDoc => ({
  type: "Heading",
  props: { id, text: id, ...extra },
});

/**
 * A page with a Section holding headings a, b and c, a second Section, and a linked copy of
 * "Opening hours"; the Header from the starter site.
 */
function setUp() {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  const content: NodeDoc[] = [
    {
      type: "Section",
      props: {
        id: "s1",
        content: [heading("a"), heading("b", { layerName: "Hours" }), heading("c")],
      },
    },
    { type: "Section", props: { id: "s2", content: [] } },
    { type: SHARED_COPY_TYPE, props: { id: "c1", sharedSectionId: HOURS } },
  ];
  const session = sessionWith({
    ...site,
    pages: { ...site.pages, [home.id]: { ...home, doc: { root: { props: {} }, content } } },
    sharedSections: {
      [HOURS]: {
        id: HOURS,
        name: "Opening hours",
        section: { type: "Section", props: { id: "s", content: [heading("t")] } },
      },
    },
  });
  const page = () => currentPage(session)?.doc.content ?? [];
  const inS1 = () => ((page()[0]?.props.content ?? []) as NodeDoc[]).map((node) => node.props.id);
  const labels = () => session.history.entries().map((entry) => entry.label);
  const select = (...ids: string[]) => session.selectElements(ids);
  return { session, page, inS1, labels, select };
}

const COPY = copiedNodeId("c1", "s");

describe("bulk actions on several selected elements (1.31, UX-3)", () => {
  it("deletes them as one step, and undo brings them back with the whole selection", () => {
    const { session, page, inS1, labels, select } = setUp();
    select("a", "c", COPY);

    expect(deleteSelected(session)).toEqual({});

    expect(inS1()).toEqual(["b"]);
    expect(page().map((node) => node.props.id)).toEqual(["s1", "s2"]);
    expect(labels()).toEqual(["Deleted 3 elements"]);
    expect(selectedIds(session.ui.getState())).toEqual([]);
    session.history.undo();
    expect(inS1()).toEqual(["a", "b", "c"]);
    expect(selectedIds(session.ui.getState())).toEqual(["a", "c", COPY]);
  });

  it("duplicates each after itself, a linked copy as another linked copy, and selects the copies", () => {
    const { session, page, inS1, labels, select } = setUp();
    select("c", "a", COPY);

    duplicateSelected(session);

    const [a, copyOfA, b, c, copyOfC] = inS1();
    expect([a, b, c]).toEqual(["a", "b", "c"]);
    const copies = page().filter(isSharedCopy);
    expect(copies.map((copy) => copy.props.sharedSectionId)).toEqual([HOURS, HOURS]);
    expect(labels()).toEqual(["Duplicated 3 elements"]);
    // The copies selected, in the page's order.
    expect(selectedIds(session.ui.getState())).toEqual([
      copyOfA,
      copyOfC,
      copiedNodeId(copies[1]?.props.id ?? "", "s"),
    ]);
  });

  it("moves them together, side by side, and moves nothing past an end, saying so", () => {
    const { session, inS1, labels, select } = setUp();
    select("b", "c");

    expect(moveSelected(session, "up")).toEqual({});
    expect(inS1()).toEqual(["b", "c", "a"]);
    expect(moveSelected(session, "up")).toEqual({
      refused: "'Hours' is already first: nothing moved.",
    });
    expect(moveSelected(session, "down")).toEqual({});
    expect(inS1()).toEqual(["a", "b", "c"]);
    expect(moveSelected(session, "down")).toEqual({
      refused: "Heading is already last: nothing moved.",
    });

    expect(labels()).toEqual(["Moved 2 elements", "Moved 2 elements"]);
    expect(selectedIds(session.ui.getState())).toEqual(["b", "c"]);
  });

  it("hides them all as one step, and shows them again when all are hidden", () => {
    const { session, page, labels, select } = setUp();
    const hidden = () => [
      ...((page()[0]?.props.content ?? []) as NodeDoc[]).map((node) => node.props.hidden === true),
      page()[2]?.props.hidden === true,
    ];
    select("a", COPY);

    toggleSelectedHidden(session);
    expect(hidden()).toEqual([true, false, false, true]);
    toggleSelectedHidden(session);

    expect(hidden()).toEqual([false, false, false, false]);
    expect(labels()).toEqual(["Hid 2 elements", "Showed 2 elements"]);
  });

  it("refuses a selection with an element of the Header or of a linked copy, saying why", () => {
    const { session, labels, select } = setUp();
    const header = session.history.document.getState().layout.header[0]?.props.id ?? "";
    const refusal = {
      refused:
        "Elements of the shared Header or Footer, or of a shared section, are changed one at a time.",
    };

    select("a", header);
    expect(deleteSelected(session)).toEqual(refusal);
    select("a", copiedNodeId("c1", "t"));
    expect(duplicateSelected(session)).toEqual(refusal);

    expect(labels()).toEqual([]);
  });

  it("acts on a section and leaves its selected elements to go with it", () => {
    const { session, page, labels, select } = setUp();
    select("b", "s1");

    deleteSelected(session);

    expect(page().map((node) => node.props.id)).toEqual(["s2", "c1"]);
    // One element left: it is named.
    expect(labels()).toEqual(["Deleted Section"]);
  });
});

describe("Select similar (1.35)", () => {
  it("finds the page's own elements of the same component, the one asked for first", () => {
    const { session } = setUp();

    expect(similarTo(session, "b")).toEqual(["b", "a", "c"]);
    // Sections: the page's own, not the linked copy's.
    expect(similarTo(session, "s2")).toEqual(["s2", "s1"]);
  });

  it("finds every linked copy of the same shared section", () => {
    const { session } = setUp();
    session.edit("insert", "Added a copy of 'Opening hours'", (draft) => {
      draft.pages[draft.homePageId]?.doc.content.push({
        type: SHARED_COPY_TYPE,
        props: { id: "c2", sharedSectionId: HOURS },
      });
    });

    expect(similarTo(session, COPY)).toEqual([COPY, copiedNodeId("c2", "s")]);
  });

  it("finds nothing for what isn't a layer: inside a linked copy, or the shared Header", () => {
    const { session } = setUp();

    expect(similarTo(session, copiedNodeId("c1", "t"))).toBeUndefined();
    const header = session.history.document.getState().layout.header[0]?.props.id ?? "";
    expect(similarTo(session, header)).toBeUndefined();
  });
});

describe("copyLayer: Ctrl/Cmd-drag in Layers (1.35, UX-4)", () => {
  it("copies a layer next to where it was dropped, with ids of its own, as one step", () => {
    const { session, inS1, labels } = setUp();

    copyLayer(session, "a", 3, false);

    const ids = inS1();
    expect(ids.slice(0, 3)).toEqual(["a", "b", "c"]);
    expect(ids).toHaveLength(4);
    const copy = ids[3] ?? "";
    expect(copy).not.toBe("a");
    expect(labels()).toEqual(["Duplicated Heading"]);
    expect(session.ui.getState()).toMatchObject({ nodeId: copy, others: [] });
    session.history.undo();
    expect(inS1()).toEqual(["a", "b", "c"]);
  });

  it("places another linked copy with Shift, and the section as the page's own without", () => {
    const { session, page, labels } = setUp();

    copyLayer(session, COPY, 3, true);
    const linked = page()[3];
    expect(linked).toMatchObject({ type: SHARED_COPY_TYPE, props: { sharedSectionId: HOURS } });
    expect(session.ui.getState().nodeId).toBe(copiedNodeId(linked?.props.id ?? "", "s"));

    copyLayer(session, COPY, 0, false);
    const own = page()[0];
    expect(own?.type).toBe("Section");
    expect(isSharedCopy(own as NodeDoc)).toBe(false);
    expect(own?.props.id).not.toBe("s");
    expect(labels()).toEqual(["Added a copy of 'Opening hours'", "Duplicated Section"]);
  });

  it("copies nothing that isn't a layer, or past the end of its list", () => {
    const { session, labels } = setUp();

    copyLayer(session, copiedNodeId("c1", "t"), 0, false);
    copyLayer(session, "a", 4, false);
    copyLayer(session, "gone", 0, false);

    expect(labels()).toEqual([]);
  });
});
