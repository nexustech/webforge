import type { AppState, PuckAction } from "@puckeditor/core";
import {
  copiedNodeId,
  type LayoutDoc,
  type NodeDoc,
  type PageDoc,
  SHARED_COPY_TYPE,
  type SharedCopyNode,
  type SharedSectionId,
  type SharedSectionsDoc,
} from "@webforge/model";
import { describe, expect, it } from "vitest";
import type { EngineEdit } from "../canvas-engine.js";
import { type CanvasDocs, routeEdit, routeLinkedCopy } from "./route-edit.js";
import { composePage } from "./shared-layout.js";
import { ROOT_ZONE } from "./tree.js";

// Where an edit Puck made goes (R8): the page, the shared Header and Footer (F-ED-7), or a shared
// section through one of its linked copies (F-ED-23). Pure: no Puck, no canvas.

const HOURS = "shared-hours" as SharedSectionId;
const heading = (id: string, text: string): NodeDoc => ({ type: "Heading", props: { id, text } });
const layout: LayoutDoc = { header: [heading("h", "Header")], footer: [heading("f", "Footer")] };
const shared: SharedSectionsDoc = {
  [HOURS]: {
    id: HOURS,
    name: "Opening hours",
    section: { type: "Section", props: { id: "s", content: [heading("t", "Hours")] } },
  },
};
const copy = { type: SHARED_COPY_TYPE, props: { id: "c1", sharedSectionId: HOURS } } as NodeDoc &
  SharedCopyNode;
const page: PageDoc = { root: { props: {} }, content: [heading("a", "First"), copy] };
const docs: CanvasDocs = { page, layout, shared };

/** Puck's state before an edit: the page as the canvas showed it. */
const prev = { data: composePage(page, layout, shared) } as unknown as AppState;

/** What the canvas shows now, with `change` made to it. */
function shownWith(change: (shown: NodeDoc[]) => void): PageDoc {
  const shown = structuredClone(composePage(page, layout, shared));
  change(shown.content);
  return shown;
}

const edit = (over: Partial<EngineEdit> & Pick<EngineEdit, "page">): EngineEdit => ({
  kind: "text",
  nodeId: null,
  componentType: "Heading",
  field: "text",
  selection: null,
  ...over,
});

const textOf = (node: NodeDoc | undefined) => node?.props.text;
const SET_TEXT = { type: "replace" } as PuckAction;

describe("routeEdit (R8)", () => {
  it("gives the page an edit of its own element, put back only if its order is off", () => {
    const shown = shownWith((nodes) => {
      (nodes[1] as NodeDoc).props.text = "Welcome";
    });

    const routed = routeEdit(edit({ nodeId: "a", page: shown }), SET_TEXT, prev, docs);

    expect(textOf(routed.next.page.content[0])).toBe("Welcome");
    // The copy stays the page's copy node, not its section as the canvas shows it.
    expect(routed.next.page.content[1]).toBe(copy);
    expect(routed.emit?.page).toBe(routed.next.page);
    expect(routed.next.layout).toBe(layout);
    expect(routed.putBack).toBe("whenOutOfOrder");
  });

  it("gives the layout an edit inside the Header, which every page shows", () => {
    const shown = shownWith((nodes) => {
      (nodes[0] as NodeDoc).props.text = "Bakery";
    });

    const routed = routeEdit(edit({ nodeId: "h", page: shown }), SET_TEXT, prev, docs);

    expect(textOf(routed.next.layout.header[0])).toBe("Bakery");
    expect(routed.next.page).toBe(page);
    expect(routed.emit).toMatchObject({ shared: true, layout: routed.next.layout, page });
  });

  it("gives the shared section an edit inside a linked copy, shown in every copy", () => {
    const shown = shownWith((nodes) => {
      const section = nodes[2] as NodeDoc;
      ((section.props.content as NodeDoc[])[0] as NodeDoc).props.text = "Open daily";
    });
    const inCopy = copiedNodeId("c1", "t");

    const routed = routeEdit(
      edit({
        nodeId: inCopy,
        selection: inCopy,
        page: shown,
        patch: { nodeId: inCopy, field: "text", value: "Open daily" },
      }),
      SET_TEXT,
      prev,
      docs,
    );

    const section = routed.next.shared[HOURS]?.section;
    const [first] = (section?.props.content ?? []) as NodeDoc[];
    expect(textOf(first)).toBe("Open daily");
    expect(routed.next.page).toBe(page);
    expect(routed.emit?.sharedSection).toEqual({ id: HOURS, section });
    // The section is recorded whole: no one-field patch naming the copy's element.
    expect(routed.emit?.patch).toBeUndefined();
    expect(routed.emit?.nodeId).toBe(inCopy);
    expect(routed.putBack).toBe("always");
  });

  it("refuses removing the Header itself, putting Puck's view back", () => {
    const shown = shownWith((nodes) => nodes.shift());

    const routed = routeEdit(
      edit({ kind: "remove", nodeId: "h", page: shown }),
      { type: "remove", zone: ROOT_ZONE, index: 0 } as PuckAction,
      prev,
      docs,
    );

    expect(routed.emit).toBeUndefined();
    expect(routed.next).toBe(docs);
    expect(routed.putBack).toBe("always");
  });

  it("refuses moving an element of the page into a linked copy", () => {
    const shown = shownWith((nodes) => {
      const [own] = nodes.splice(1, 1);
      const section = nodes[1] as NodeDoc;
      (section.props.content as NodeDoc[]).push(own as NodeDoc);
    });

    const routed = routeEdit(
      edit({ kind: "move", nodeId: "a", page: shown }),
      SET_TEXT,
      prev,
      docs,
    );

    expect(routed.emit).toBeUndefined();
    expect(routed.next).toBe(docs);
    expect(routed.putBack).toBe("always");
  });

  it("gives the page back an element Puck shows below the Footer, between the Header and Footer", () => {
    const shown = shownWith((nodes) => {
      const [own] = nodes.splice(1, 1);
      nodes.push(own as NodeDoc);
    });

    const routed = routeEdit(
      edit({ kind: "move", nodeId: "a", page: shown }),
      SET_TEXT,
      prev,
      docs,
    );

    expect(routed.emit?.page).toBe(routed.next.page);
    expect(routed.next.layout).toBe(layout);
    expect(routed.putBack).toBe("whenOutOfOrder");
  });

  it("makes a duplicated copy another linked copy of its section, selected as the canvas shows it", () => {
    const shown = shownWith(() => {});

    const routed = routeEdit(
      edit({ kind: "duplicate", nodeId: "s", page: shown }),
      { type: "duplicate", sourceZone: ROOT_ZONE, sourceIndex: 2 } as PuckAction,
      prev,
      docs,
    );

    const added = routed.next.page.content[2] as NodeDoc & SharedCopyNode;
    expect(added.type).toBe(SHARED_COPY_TYPE);
    expect(added.props.sharedSectionId).toBe(HOURS);
    expect(routed.emit).toMatchObject({
      copyOf: HOURS,
      selection: copiedNodeId(added.props.id, "s"),
      page: routed.next.page,
    });
    expect(routed.putBack).toBe("always");
  });
});

describe("routeLinkedCopy (R8)", () => {
  const drop = (destinationIndex: number, destinationZone = ROOT_ZONE) => ({
    sourceZone: ROOT_ZONE,
    sourceIndex: 2,
    destinationZone,
    destinationIndex,
  });

  it("places another copy among the page's sections, counting the Header out", () => {
    // Before the first element: Puck counts the Header, and the dragged copy stays.
    const routed = routeLinkedCopy(copy, drop(1), docs);

    expect(routed.next.page.content.map((node) => node.type)).toEqual([
      SHARED_COPY_TYPE,
      "Heading",
      SHARED_COPY_TYPE,
    ]);
    expect(routed.emit).toMatchObject({ kind: "duplicate", copyOf: HOURS });
    expect(routed.putBack).toBe("always");
  });

  it("refuses a drop outside the page's own zone", () => {
    const routed = routeLinkedCopy(copy, drop(0, "s:content"), docs);

    expect(routed.emit).toBeUndefined();
    expect(routed.next).toBe(docs);
  });
});
