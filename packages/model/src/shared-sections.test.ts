import { describe, expect, it } from "vitest";
import type { LayoutDoc, NodeDoc } from "./documents.js";
import type { SharedSectionId } from "./ids.js";
import {
  copiedAnchor,
  copiedNodeId,
  copyHolding,
  expandSharedCopies,
  isSharedCopy,
  newSharedCopy,
  pageAnchors,
  SHARED_COPY_TYPE,
  type SharedSectionsDoc,
  sharedSectionsDocSchema,
} from "./shared-sections.js";

const HOURS = "shared-hours" as SharedSectionId;

const hours: NodeDoc = {
  type: "Section",
  props: {
    id: "hours",
    advanced: { anchorId: "opening-hours", className: "bg-base-200" },
    content: [
      { type: "Heading", props: { id: "title", text: "Opening hours" } },
      {
        type: "Faq",
        props: {
          id: "faq",
          items: [
            { type: "FaqItem", props: { id: "q1", question: "Sunday?", answer: "<p>No</p>" } },
          ],
        },
      },
    ],
  },
};

const shared: SharedSectionsDoc = { [HOURS]: { id: HOURS, name: "Opening hours", section: hours } };

const layout: LayoutDoc = { header: [], footer: [] };

const copy = (id: string, anchorSuffix?: string): NodeDoc => ({
  type: SHARED_COPY_TYPE,
  props: {
    id,
    sharedSectionId: HOURS,
    ...(anchorSuffix === undefined ? {} : { anchorSuffix }),
  },
});

describe("shared sections (F-ED-23)", () => {
  it("validates the site's shared sections", () => {
    expect(sharedSectionsDocSchema.safeParse(shared).success).toBe(true);
    // The key must be the section's id, and it needs a name.
    expect(
      sharedSectionsDocSchema.safeParse({ other: { ...shared[HOURS], id: HOURS } }).success,
    ).toBe(false);
    expect(
      sharedSectionsDocSchema.safeParse({ [HOURS]: { ...shared[HOURS], name: "  " } }).success,
    ).toBe(false);
  });

  it("refuses a shared section holding a copy of a shared section, at any depth", () => {
    const nested = {
      ...shared[HOURS],
      section: { ...hours, props: { ...hours.props, content: [copy("inner")] } },
    };

    expect(sharedSectionsDocSchema.safeParse({ [HOURS]: nested }).success).toBe(false);
  });

  it("refuses unsafe keys inside a shared section", () => {
    const raw = JSON.parse(
      `{"${HOURS}":{"id":"${HOURS}","name":"x","section":{"type":"Section","props":{"id":"s","__proto__":{"bad":1}}}}}`,
    );

    expect(sharedSectionsDocSchema.safeParse(raw).success).toBe(false);
  });

  it("knows a linked copy", () => {
    expect(isSharedCopy(copy("c"))).toBe(true);
    expect(isSharedCopy(hours)).toBe(false);
    expect(isSharedCopy({ type: SHARED_COPY_TYPE, props: { id: "c" } })).toBe(false);
  });

  it("shows each copy as its section, with ids of its own at any depth", () => {
    const page: NodeDoc[] = [{ type: "Heading", props: { id: "top", text: "Hi" } }, copy("c1")];

    const [top, section] = expandSharedCopies(page, shared);

    expect(top).toBe(page[0]);
    expect(section?.props.id).toBe(copiedNodeId("c1", "hours"));
    expect(JSON.stringify(section)).toContain(`"id":"${copiedNodeId("c1", "q1")}"`);
    expect(JSON.stringify(section)).not.toMatch(/"id":"(hours|title|faq|q1)"/);
    // The rest of the section as it is, the anchor and classes included.
    expect(section?.props.advanced).toEqual({
      anchorId: "opening-hours",
      className: "bg-base-200",
    });
    expect(shared[HOURS]?.section).toBe(hours);
  });

  it("gives a second copy on a page anchors of its own, so links to each copy work", () => {
    const [first, second] = expandSharedCopies([copy("c1"), copy("c2", "2")], shared);

    expect(first?.props.advanced?.anchorId).toBe("opening-hours");
    expect(second?.props.advanced?.anchorId).toBe(copiedAnchor("opening-hours", "2"));
    expect(second?.props.advanced?.anchorId).toBe("opening-hours-2");
  });

  it("shows nothing for a copy of a shared section that isn't there", () => {
    const gone: NodeDoc = { type: SHARED_COPY_TYPE, props: { id: "c", sharedSectionId: "gone" } };

    expect(expandSharedCopies([gone], shared)).toEqual([]);
  });

  it("makes new copies for a page: the first keeps the anchors, others get the lowest free suffix", () => {
    const first = newSharedCopy([], HOURS, shared, layout);
    expect(first.props.anchorSuffix).toBeUndefined();
    expect(isSharedCopy(first)).toBe(true);

    const second = newSharedCopy([first], HOURS, shared, layout);
    expect(second.props.anchorSuffix).toBe("2");
    expect(second.props.id).not.toBe(first.props.id);

    // A suffix stays with its copy: deleting copy 2 frees "2" for the next one, not "3".
    const third = newSharedCopy([first, copy("c3", "3")], HOURS, shared, layout);
    expect(third.props.anchorSuffix).toBe("2");
    // Copies of other sections don't count.
    const OTHER = "shared-other" as SharedSectionId;
    expect(newSharedCopy([first], OTHER, shared, layout).props.anchorSuffix).toBeUndefined();
  });

  it("gives a new copy no anchor the page, its Header or its Footer already has", () => {
    const anchored = (id: string, anchorId: string): NodeDoc => ({
      type: "Section",
      props: { id, advanced: { anchorId }, content: [] },
    });
    // The link dialog numbers anchors the same way: a section already has `opening-hours-2`.
    const page = [copy("c1"), anchored("other", "opening-hours-2")];
    expect(newSharedCopy(page, HOURS, shared, layout).props.anchorSuffix).toBe("3");

    // The first copy too, when a section of the page has the shared section's anchor.
    const footer = { header: [], footer: [anchored("f", "opening-hours")] };
    expect(newSharedCopy([], HOURS, shared, footer).props.anchorSuffix).toBe("2");
  });

  it("keeps a copy's anchors no longer than an anchor may be", () => {
    const long = `a${"-b".repeat(31)}c`;
    expect(long.length).toBe(64);

    expect(copiedAnchor(long, "12")).toHaveLength(64);
    expect(copiedAnchor(long, "12")).toMatch(/^a(-b)+-12$/);
    // Shortened where a hyphen would end it: no `--`.
    expect(copiedAnchor(long, "2")).toHaveLength(63);
    expect(copiedAnchor(long, "2")).toMatch(/^a(-b)+-2$/);
    expect(copiedAnchor(long, undefined)).toBe(long);
  });

  it("finds the anchors on a page, and the copy holding an element the canvas shows", () => {
    const page = [copy("c1"), copy("c2", "2")];

    expect([...pageAnchors(page, shared, layout)].sort()).toEqual([
      "opening-hours",
      "opening-hours-2",
    ]);
    expect(copyHolding(page, copiedNodeId("c2", "faq"))?.props.id).toBe("c2");
    expect(copyHolding(page, "faq")).toBeUndefined();
  });
});
