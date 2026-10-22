import {
  copiedNodeId,
  expandSharedCopies,
  type NodeDoc,
  SHARED_COPY_TYPE,
  type SharedSectionId,
  type SharedSectionsDoc,
} from "@webforge/model";
import { describe, expect, it } from "vitest";
import { foldCopies } from "./shared-copies.js";

const HOURS = "shared-hours" as SharedSectionId;
const shared: SharedSectionsDoc = {
  [HOURS]: {
    id: HOURS,
    name: "Opening hours",
    section: {
      type: "Section",
      props: {
        id: "s",
        advanced: { anchorId: "hours" },
        content: [{ type: "Heading", props: { id: "t", text: "Hours" } }],
      },
    },
  },
};
const own: NodeDoc[] = [
  { type: "Heading", props: { id: "a", text: "First" } },
  { type: SHARED_COPY_TYPE, props: { id: "c1", sharedSectionId: HOURS } },
  { type: SHARED_COPY_TYPE, props: { id: "c2", sharedSectionId: HOURS, anchorSuffix: "2" } },
];
const shown = () => structuredClone(expandSharedCopies(own, shared));

describe("foldCopies (F-ED-23)", () => {
  it("folds each copy back into its copy node, with no change to its section", () => {
    const folded = foldCopies(shown(), own, shared, null);

    expect(folded.content).toEqual(own);
    expect(folded.content[1]).toBe(own[1]);
    expect(folded.sections.size).toBe(0);
  });

  it("gives a section as the copy changed it, ids and anchors back as the section has them", () => {
    const now = shown();
    const second = now[2] as NodeDoc;
    const inner = (second.props.content as NodeDoc[])[0] as NodeDoc;
    inner.props.text = "Open daily";
    // An element added inside the copy keeps the id Puck gave it.
    (second.props.content as NodeDoc[]).push({ type: "Text", props: { id: "new", text: "x" } });

    const folded = foldCopies(now, own, shared, copiedNodeId("c2", "t"));

    expect(folded.content).toEqual(own);
    expect(folded.sections.get(HOURS)).toEqual({
      type: "Section",
      props: {
        id: "s",
        advanced: { anchorId: "hours" },
        content: [
          { type: "Heading", props: { id: "t", text: "Open daily" } },
          { type: "Text", props: { id: "new", text: "x" } },
        ],
      },
    });
  });

  it("takes the copy the edit was in, when another still shows the section as it was", () => {
    const now = shown();
    ((now[1] as NodeDoc).props.content as NodeDoc[])[0] = {
      type: "Heading",
      props: { id: copiedNodeId("c1", "t"), text: "Stale" },
    };
    ((now[2] as NodeDoc).props.content as NodeDoc[])[0] = {
      type: "Heading",
      props: { id: copiedNodeId("c2", "t"), text: "Typed" },
    };

    const folded = foldCopies(now, own, shared, copiedNodeId("c2", "t"));

    expect(JSON.stringify(folded.sections.get(HOURS))).toContain("Typed");
  });

  it("shows an element moved out of a copy as a change to the page and the section both", () => {
    const now = shown();
    const moved = ((now[1] as NodeDoc).props.content as NodeDoc[]).pop() as NodeDoc;
    now.push(moved);

    const folded = foldCopies(now, own, shared, moved.props.id);

    // The engine refuses such a move: an element goes in or out of a copy only by copy and paste.
    expect(folded.content.map((node) => node.props.id)).toEqual(["a", "c1", "c2", moved.props.id]);
    expect(folded.sections.has(HOURS)).toBe(true);
  });

  it("leaves a copy that was deleted out", () => {
    const now = shown().filter((node) => node.props.id !== copiedNodeId("c1", "s"));

    expect(foldCopies(now, own, shared, null).content.map((node) => node.props.id)).toEqual([
      "a",
      "c2",
    ]);
  });
});
