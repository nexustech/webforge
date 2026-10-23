// @vitest-environment happy-dom
import type { NodeDoc, PageDoc } from "@webforge/model";
import { afterEach, describe, expect, it } from "vitest";
import {
  copyIndex,
  type DragKeys,
  insertedAt,
  takeDragKeys,
  trackDragKeys,
} from "./drag-copies.js";
import { ROOT_ZONE } from "./tree.js";

const node = (id: string, content?: NodeDoc[]): NodeDoc => ({
  type: content === undefined ? "Heading" : "Section",
  props: content === undefined ? { id } : { id, content },
});

describe("copyIndex (1.30, UX-4)", () => {
  it("puts the copy where the drop was, the original staying in its own list", () => {
    // [A, X, B, C]: X dropped after B. Puck counts without X ([A, B, X, C]); with X kept, after B.
    expect(
      copyIndex({ sourceZone: "s:c", sourceIndex: 1, destinationZone: "s:c", destinationIndex: 2 }),
    ).toBe(3);
    // Dropped before itself, or in another list: where Puck says.
    expect(
      copyIndex({ sourceZone: "s:c", sourceIndex: 2, destinationZone: "s:c", destinationIndex: 0 }),
    ).toBe(0);
    expect(
      copyIndex({ sourceZone: "s:c", sourceIndex: 0, destinationZone: "t:c", destinationIndex: 1 }),
    ).toBe(1);
  });
});

describe("insertedAt", () => {
  const page: PageDoc = {
    root: { props: {} },
    content: [node("s1", [node("a"), node("b")]), node("s2", [node("c")])],
  };

  it("inserts into the page's own list or into an element's slot", () => {
    const ids = (doc: PageDoc) =>
      doc.content.map((each) => [
        each.props.id,
        (each.props.content as NodeDoc[] | undefined)?.map((child) => child.props.id),
      ]);

    expect(ids(insertedAt(page, ROOT_ZONE, 1, node("x", [])))).toEqual([
      ["s1", ["a", "b"]],
      ["x", []],
      ["s2", ["c"]],
    ]);
    const nested = insertedAt(page, "s1:content", 1, node("x"));
    expect(ids(nested)).toEqual([
      ["s1", ["a", "x", "b"]],
      ["s2", ["c"]],
    ]);
    // Only the way down to the slot is new: the rest is as it was.
    expect(nested.content[1]).toBe(page.content[1]);
    expect(page.content[0]?.props.content).toHaveLength(2);
  });

  it("leaves the page as it is for a zone it doesn't have", () => {
    expect(insertedAt(page, "gone:content", 0, node("x"))).toBe(page);
  });
});

describe("trackDragKeys", () => {
  let stop = () => {};
  afterEach(() => stop());

  const keys = (): DragKeys => ({ copy: false, linked: false, pressed: false });
  const pointer = (type: string, init: PointerEventInit = {}) =>
    window.dispatchEvent(new PointerEvent(type, init));
  const key = (type: string, init: KeyboardEventInit) =>
    window.dispatchEvent(new KeyboardEvent(type, init));

  it("follows Ctrl or Cmd, and Shift, from the pointer and the keys while it is down", () => {
    const held = keys();
    stop = trackDragKeys(window, held);

    pointer("pointerdown", { ctrlKey: true });
    expect(held).toMatchObject({ copy: true, linked: false, pressed: true });
    key("keydown", { key: "Shift", metaKey: true, shiftKey: true });
    expect(held).toMatchObject({ copy: true, linked: true });
    key("keyup", { key: "Shift", metaKey: true });
    expect(held.linked).toBe(false);
    pointer("pointerup", { ctrlKey: true });

    // Kept as they were at the drop, which Puck makes a moment later.
    key("keyup", { key: "Control" });
    expect(held).toMatchObject({ copy: true, pressed: false });
  });

  it("never counts Ctrl from the keyboard alone, as a keyboard move holds it", () => {
    const held = keys();
    stop = trackDragKeys(window, held);

    key("keydown", { key: "ArrowDown", ctrlKey: true, altKey: true });
    expect(held.copy).toBe(false);
    pointer("pointerdown");
    pointer("pointerup");
    expect(held.copy).toBe(false);
  });

  it("gives each drop the keys held for it once, so a later drag can't inherit them (#255 review)", () => {
    const held = keys();
    stop = trackDragKeys(window, held);
    pointer("pointerdown", { ctrlKey: true, shiftKey: true });
    pointer("pointerup", { ctrlKey: true, shiftKey: true });

    expect(takeDragKeys(held)).toEqual({ copy: true, linked: true });
    // A drag from the keyboard next: no pointer, so nothing held.
    expect(takeDragKeys(held)).toEqual({ copy: false, linked: false });
  });

  it("stops following", () => {
    const held = keys();
    trackDragKeys(window, held)();

    pointer("pointerdown", { ctrlKey: true });

    expect(held).toEqual(keys());
  });
});
