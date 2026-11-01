import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  clipboardPayload,
  copiedElementsSchema,
  pastedCopies,
  readClipboardPayload,
} from "./clipboard.js";
import type { NodeDoc } from "./documents.js";
import type { MediaId } from "./ids.js";
import type { MediaMeta } from "./media.js";
import { SITE_FORMAT_VERSION } from "./site-doc.js";

const section: NodeDoc = {
  type: "Section",
  props: {
    id: "s1",
    advanced: { anchorId: "menu", className: "mt-4" },
    content: [
      { type: "Heading", props: { id: "h1", text: "Cakes", bindings: { text: "contact.phone" } } },
      { type: "Hero", props: { id: "hero", image: { mediaId: "photo" } } },
    ],
  },
};

/** Every node id in `nodes` and their slots. */
function idsOf(nodes: readonly unknown[]): string[] {
  return nodes.flatMap((node) => {
    const { props } = node as NodeDoc;
    const nested = Object.values(props).filter(Array.isArray);
    return [props.id, ...nested.flatMap((list) => idsOf(list))];
  });
}

/** A tree of nodes, a few levels deep, with slots under any prop name. */
const tree = fc.letrec<{ node: NodeDoc }>((tie) => ({
  node: fc.record({
    type: fc.constantFrom("Section", "Heading", "Faq"),
    props: fc.record({
      id: fc.constantFrom("a", "b", "c"),
      text: fc.string({ maxLength: 5 }),
      content: fc.oneof(
        { maxDepth: 3, depthIdentifier: "tree" },
        fc.constant([]),
        fc.array(tie("node"), { minLength: 1, maxLength: 3 }),
      ),
    }),
  }),
})).node;

describe("pastedCopies", () => {
  it("gives every element, slots included, a new id and keeps everything else", () => {
    let next = 0;
    const [copy] = pastedCopies([section], new Set(), () => `new${++next}`);

    expect(copy).toEqual({
      type: "Section",
      props: {
        id: "new1",
        advanced: { anchorId: "menu", className: "mt-4" },
        content: [
          {
            type: "Heading",
            props: { id: "new2", text: "Cakes", bindings: { text: "contact.phone" } },
          },
          // The image keeps its Media id.
          { type: "Hero", props: { id: "new3", image: { mediaId: "photo" } } },
        ],
      },
    });
    // A copy, not the original.
    expect(section.props.id).toBe("s1");
  });

  it("leaves out an anchor the page already has, keeping the rest of the options", () => {
    const [copy] = pastedCopies([section], new Set(["menu"]));
    expect(copy?.props.advanced).toEqual({ className: "mt-4" });

    const bare: NodeDoc = { type: "Section", props: { id: "s", advanced: { anchorId: "menu" } } };
    expect(pastedCopies([bare], new Set(["menu"]))[0]?.props).not.toHaveProperty("advanced");
    // Two copies pasted at once: only the first keeps it.
    const [first, second] = pastedCopies([bare, bare]);
    expect(first?.props.advanced).toEqual({ anchorId: "menu" });
    expect(second?.props).not.toHaveProperty("advanced");
  });

  it("never repeats an id, within the copies or with the original", () => {
    fc.assert(
      fc.property(fc.array(tree, { minLength: 1, maxLength: 4 }), (nodes) => {
        const ids = idsOf(pastedCopies(nodes));
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.some((id) => idsOf(nodes).includes(id))).toBe(false);
      }),
      { numRuns: 200 },
    );
  });
});

describe("copiedElementsSchema", () => {
  it("accepts copied elements and refuses anything else", () => {
    const copied = { nodes: [section], media: [] };
    expect(copiedElementsSchema.parse(copied)).toEqual(copied);
    expect(copiedElementsSchema.safeParse({ nodes: [], media: [] }).success).toBe(false);
    expect(
      copiedElementsSchema.safeParse({ nodes: [{ type: "Heading" }], media: [] }).success,
    ).toBe(false);
    expect(
      copiedElementsSchema.safeParse(
        JSON.parse('{"nodes":[{"type":"Heading","props":{"id":"h","__proto__":{}}}],"media":[]}'),
      ).success,
    ).toBe(false);
  });

  it("pastes elements another program put there without the attributes only the export writes (#650)", () => {
    const advanced = { attributes: { "data-wf-consent": "", "data-track": "x" } };
    const copied = copiedElementsSchema.parse({
      nodes: [
        {
          type: "Section",
          props: { id: "s", content: [{ type: "Heading", props: { id: "h", advanced } }] },
        },
      ],
      media: [],
    });

    const [inner] = (copied.nodes[0]?.props.content ?? []) as readonly NodeDoc[];
    expect(inner?.props.advanced).toEqual({ attributes: { "data-track": "x" } });
  });
});

describe("copied elements across builds (ADR 0012)", () => {
  const photo: MediaMeta = {
    id: "photo" as MediaId,
    hash: "a".repeat(64),
    name: "shop",
    fileName: "shop.jpg",
    kind: "image",
    mimeType: "image/jpeg",
    width: 10,
    height: 10,
    alt: "",
  };

  it("names this build's site format, and reads it back as it was", () => {
    const copied = { nodes: [section], media: [photo], sharedSectionId: undefined };
    const payload = clipboardPayload(copied);

    expect(payload.formatVersion).toBe(SITE_FORMAT_VERSION);
    expect(readClipboardPayload(JSON.parse(JSON.stringify(payload)))).toEqual({
      status: "elements",
      elements: { nodes: [section], media: [photo] },
    });
  });

  it("brings elements copied in an older format up to this one, through the whole chain", () => {
    // Format 1: a Hero's image was a media id with its description beside it, and a Section's
    // padding one size, and full width a toggle.
    const old = {
      formatVersion: 1,
      nodes: [
        {
          type: "Section",
          props: {
            id: "s",
            padding: "small",
            fullWidth: true,
            content: [
              { type: "Hero", props: { id: "h", image: "photo", imageDescription: "Our shop" } },
            ],
          },
        },
      ],
      media: [photo],
    };

    const read = readClipboardPayload(old);

    expect(read.status).toBe("elements");
    if (read.status !== "elements") return;
    const [copied] = read.elements.nodes;
    expect(copied?.props.padding).toEqual({ top: "s", bottom: "s" });
    expect(copied?.props.contentWidth).toBe("full");
    expect(copied?.props.fullWidth).toBeUndefined();
    const [hero] = (copied?.props.content ?? []) as readonly NodeDoc[];
    expect(hero?.props.image).toEqual({ mediaId: "photo", alt: "Our shop" });
    expect(read.elements.media).toEqual([photo]);
  });

  it("takes elements copied before the clipboard named a format as format 12", () => {
    const read = readClipboardPayload({ nodes: [section], media: [] });
    expect(read).toEqual({ status: "elements", elements: { nodes: [section], media: [] } });
  });

  it("refuses elements copied in a newer build, and anything that isn't elements", () => {
    expect(
      readClipboardPayload({ formatVersion: SITE_FORMAT_VERSION + 1, nodes: [section], media: [] }),
    ).toEqual({ status: "newer-format" });
    for (const raw of [
      null,
      [section],
      "nodes",
      { formatVersion: 0, nodes: [section], media: [] },
      { formatVersion: "12", nodes: [section], media: [] },
      { formatVersion: 3, nodes: "x", media: [] },
      { formatVersion: 3, nodes: [{ type: "Heading" }], media: [] },
      { formatVersion: SITE_FORMAT_VERSION, nodes: [], media: [] },
    ]) {
      expect(readClipboardPayload(raw)).toEqual({ status: "invalid" });
    }
  });
});
