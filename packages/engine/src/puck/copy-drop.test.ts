import type { AppState, PuckAction } from "@puckeditor/core";
import {
  copiedNodeId,
  type LayoutDoc,
  type NodeDoc,
  type PageDoc,
  SHARED_COPY_TYPE,
  type SharedSectionId,
  type SharedSectionsDoc,
} from "@webforge/model";
import { describe, expect, it } from "vitest";
import { copyDrop, planCopyDrop } from "./copy-drop.js";
import type { DragKeys } from "./drag-copies.js";
import type { CanvasDocs } from "./route-edit.js";
import { composePage } from "./shared-layout.js";
import { ROOT_ZONE } from "./tree.js";

// A drag with Ctrl or Cmd held (1.30, UX-4), and with Shift a linked copy (F-ED-23): which drops
// are copies, and what each one does. Pure: no Puck, no canvas.

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
const copy: NodeDoc = { type: SHARED_COPY_TYPE, props: { id: "c1", sharedSectionId: HOURS } };
const page: PageDoc = { root: { props: {} }, content: [heading("a", "First"), copy] };
const docs: CanvasDocs = { page, layout, shared };

/** Puck's state before the drop, while dragging. */
const prev = {
  data: composePage(page, layout, shared),
  ui: { isDragging: true },
} as unknown as AppState;

/** A drop from `sourceIndex` of the page's own zone (the Header counts) to the end of it. */
const drop = (sourceIndex: number, destinationZone = ROOT_ZONE) => ({
  sourceZone: ROOT_ZONE,
  sourceIndex,
  destinationZone,
  destinationIndex: 3,
});

describe("copyDrop (1.30)", () => {
  const keys = (copy: boolean, linked = false): DragKeys => ({ copy, linked, pressed: copy });
  const move = { type: "move", ...drop(1) } as PuckAction;

  it("takes a drop with Ctrl or Cmd held for a copy, and Shift for a linked one", () => {
    expect(copyDrop(move, prev, keys(true))).toMatchObject({ drop: drop(1), linked: false });
    expect(copyDrop(move, prev, keys(true, true))?.linked).toBe(true);
  });

  it("leaves a move alone without the keys, from the keyboard, or an insert from Add", () => {
    expect(copyDrop(move, prev, keys(false))).toBeNull();
    const notDragging = { ...prev, ui: { isDragging: false } } as unknown as AppState;
    expect(copyDrop(move, notDragging, keys(true))).toBeNull();
    expect(copyDrop({ type: "insert" } as PuckAction, prev, keys(true))).toBeNull();
  });

  it("reads a reorder as a drop within its own zone", () => {
    const reorder = {
      type: "reorder",
      sourceIndex: 1,
      destinationIndex: 2,
      destinationZone: ROOT_ZONE,
    } as PuckAction;

    expect(copyDrop(reorder, prev, keys(true))?.drop.sourceZone).toBe(ROOT_ZONE);
  });

  it("takes the keys held for the drop, so the next one starts afresh", () => {
    const held = keys(true);
    copyDrop(move, prev, held);

    expect(held.copy).toBe(false);
  });
});

describe("planCopyDrop (1.30, F-ED-23)", () => {
  it("copies a page element where it dropped, with ids of its own, as one Duplicate", () => {
    const plan = planCopyDrop(drop(1), false, prev, docs);

    expect(plan.kind).toBe("copy");
    if (plan.kind !== "copy") return;
    const ids = ["h", "a", copiedNodeId("c1", "s"), "f"];
    const added = plan.after.content.find((node) => !ids.includes(node.props.id)) as NodeDoc;
    expect(added.type).toBe("Heading");
    expect(added.props.text).toBe("First");
    expect(plan.edit).toMatchObject({
      kind: "duplicate",
      nodeId: added.props.id,
      page: plan.after,
    });
  });

  it("places another linked copy for a linked copy dragged with Shift", () => {
    const plan = planCopyDrop(drop(2), true, prev, docs);

    expect(plan).toEqual({ kind: "linked", copy });
  });

  it("refuses copying the Header itself, or with Shift an element inside a linked copy", () => {
    expect(planCopyDrop(drop(0), false, prev, docs).kind).toBe("refuse");
    const withInner = {
      ...prev,
      data: {
        ...prev.data,
        content: [heading(copiedNodeId("c1", "t"), "Hours")],
      },
    } as unknown as AppState;
    expect(planCopyDrop(drop(0), true, withInner, docs).kind).toBe("refuse");
  });
});
