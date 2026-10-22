import {
  copiedNodeId,
  expandSharedCopies,
  type NodeDoc,
  SHARED_COPY_TYPE,
  type SharedSectionId,
  type SharedSectionsDoc,
} from "@webforge/model";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { foldCopies, shownInCopy } from "./shared-copies.js";
import { sameNodes } from "./shared-layout.js";

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
    const folded = foldCopies(shown(), own, shared);

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

    const folded = foldCopies(now, own, shared);

    expect(folded.content).toEqual(own);
    expect(folded.sections.get(HOURS)?.section).toEqual({
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

  it("counts only the copy that changed, not one still showing the section as it was", () => {
    const now = shown();
    ((now[2] as NodeDoc).props.content as NodeDoc[])[0] = {
      type: "Heading",
      props: { id: copiedNodeId("c2", "t"), text: "Typed" },
    };

    const folded = foldCopies(now, own, shared);

    expect(folded.refused).toBe(false);
    expect(folded.sections.get(HOURS)?.copyId).toBe("c2");
    expect(JSON.stringify(folded.sections.get(HOURS)?.section)).toContain("Typed");
  });

  it("refuses an element moved from one copy to another of the same section", () => {
    const now = shown();
    const moved = ((now[1] as NodeDoc).props.content as NodeDoc[]).pop() as NodeDoc;
    ((now[2] as NodeDoc).props.content as NodeDoc[]).push(moved);

    // Both copies changed: taking either would leave the section with the other copy's id (c1~t).
    expect(foldCopies(now, own, shared).refused).toBe(true);
  });

  it("sees no change in a section whose keys Puck put in another order", () => {
    const now = shown();
    const section = now[1] as NodeDoc;
    now[1] = {
      type: section.type,
      props: Object.fromEntries(Object.entries(section.props).reverse()) as NodeDoc["props"],
    };

    expect(foldCopies(now, own, shared).sections.size).toBe(0);
  });

  it("keeps a copy's own Layers name and hidden state out of its shared section (F-ED-12)", () => {
    const named: NodeDoc[] = [
      {
        ...(own[1] as NodeDoc),
        props: { ...(own[1] as NodeDoc).props, layerName: "Again", hidden: true },
      },
      own[2] as NodeDoc,
    ];
    const now = structuredClone(expandSharedCopies(named, shared));
    expect(now[0]?.props).toMatchObject({ layerName: "Again", hidden: true });

    expect(foldCopies(now, named, shared).sections.size).toBe(0);

    // A change in that copy still goes to the section, without the copy's own name.
    const inner = ((now[0] as NodeDoc).props.content as NodeDoc[])[0] as NodeDoc;
    inner.props.text = "Open daily";
    const section = foldCopies(now, named, shared).sections.get(HOURS)?.section;
    expect(section?.props.layerName).toBeUndefined();
    expect(section?.props.hidden).toBeUndefined();
    expect(JSON.stringify(section)).toContain("Open daily");
  });

  it("folds an anchor the copy shortened back to the section's own", () => {
    const long = `a${"-b".repeat(31)}c`;
    const section = shared[HOURS]?.section as NodeDoc;
    const withLong: SharedSectionsDoc = {
      [HOURS]: {
        id: HOURS,
        name: "Opening hours",
        section: { ...section, props: { ...section.props, advanced: { anchorId: long } } },
      },
    };
    const now = structuredClone(expandSharedCopies(own, withLong));
    expect((now[2] as NodeDoc).props.advanced?.anchorId).not.toContain(long);

    expect(foldCopies(now, own, withLong).sections.size).toBe(0);
  });

  it("gives an element added inside a copy the copy's id for it, and leaves other ids", () => {
    const changed = {
      copyId: "c2",
      section: {
        ...(shared[HOURS]?.section as NodeDoc),
        props: { id: "s", content: [{ type: "Text", props: { id: "new" } }] },
      },
    };

    expect(shownInCopy(changed, "new")).toBe(copiedNodeId("c2", "new"));
    expect(shownInCopy(changed, copiedNodeId("c2", "t"))).toBe(copiedNodeId("c2", "t"));
    expect(shownInCopy(changed, "a")).toBe("a");
    expect(shownInCopy(changed, null)).toBeNull();
  });

  it("never lets an id a copy gives an element into a shared section", () => {
    // Every move of one element anywhere on the page, its copies' slots included: whatever the
    // engine would take as an edit of one shared section, the section holds only its own ids.
    const places = (nodes: NodeDoc[]): NodeDoc[][] => [
      nodes,
      ...nodes.flatMap((node) =>
        Array.isArray(node.props.content) ? places(node.props.content as NodeDoc[]) : [],
      ),
    ];
    fc.assert(
      fc.property(fc.nat(), fc.nat(), fc.nat(), fc.nat(), (from, at, to, index) => {
        const now = shown();
        const lists = places(now);
        const source = lists[from % lists.length] as NodeDoc[];
        if (source.length === 0) return;
        const [moved] = source.splice(at % source.length, 1);
        if (moved === undefined) return;
        const target = places(now)[to % lists.length] ?? now;
        target.splice(index % (target.length + 1), 0, moved);

        const folded = foldCopies(now, own, shared);
        const pageChanged = !sameNodes(folded.content, own);
        if (folded.refused || pageChanged || folded.sections.size > 1) return;
        for (const { section } of folded.sections.values()) {
          expect(JSON.stringify(section)).not.toContain("~");
        }
      }),
      { numRuns: 300 },
    );
  });

  it("shows an element moved out of a copy as a change to the page and the section both", () => {
    const now = shown();
    const moved = ((now[1] as NodeDoc).props.content as NodeDoc[]).pop() as NodeDoc;
    now.push(moved);

    const folded = foldCopies(now, own, shared);

    // The engine refuses such a move: an element goes in or out of a copy only by copy and paste.
    expect(folded.content.map((node) => node.props.id)).toEqual(["a", "c1", "c2", moved.props.id]);
    expect(folded.sections.has(HOURS)).toBe(true);
  });

  it("leaves a copy that was deleted out", () => {
    const now = shown().filter((node) => node.props.id !== copiedNodeId("c1", "s"));

    expect(foldCopies(now, own, shared).content.map((node) => node.props.id)).toEqual(["a", "c2"]);
  });
});
