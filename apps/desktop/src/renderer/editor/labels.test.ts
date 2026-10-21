import type { EngineEdit, EngineEditKind } from "@webforge/engine";
import type { PageDoc } from "@webforge/model";
import { siteLibrary, starterPage } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { labelFor } from "./labels.js";

const edit = (kind: EngineEdit["kind"], extra: Partial<EngineEdit> = {}): EngineEdit => ({
  kind,
  nodeId: "x",
  componentType: "Heading",
  field: null,
  page: starterPage(),
  selection: null,
  ...extra,
});

/** A page whose heading the user named "Opening times" in Layers. */
const named: PageDoc = {
  root: { props: {} },
  content: [
    {
      type: "Section",
      props: {
        id: "s",
        content: [
          { type: "Heading", props: { id: "h", text: "Hours", layerName: " Opening times " } },
        ],
      },
    },
  ],
};

describe("labelFor", () => {
  it.each([
    ["insert", {}, "Added Heading"],
    ["move", {}, "Moved Heading"],
    ["remove", {}, "Deleted Heading"],
    ["duplicate", {}, "Duplicated Heading"],
    ["text", { field: "text" }, "Edited Heading text"],
    ["props", { field: "size" }, "Changed Heading size"],
    ["props", { field: "unknown" }, "Edited page"],
    ["props", { field: null }, "Edited page"],
    ["root", { componentType: null }, "Changed page settings"],
    ["page", { componentType: null }, "Edited page"],
    ["insert", { componentType: "Custom" }, "Added Custom"],
    ["insert", { componentType: null }, "Added "],
  ] as const)("labels a %s edit %o as %s", (kind, extra, expected) => {
    expect(labelFor(edit(kind, extra), siteLibrary)).toBe(expected);
  });

  it("names the text field for elements with several texts, like a Hero", () => {
    const hero = (field: string) =>
      labelFor(edit("text", { componentType: "Hero", field }), siteLibrary);

    expect(hero("buttonLabel")).toBe("Edited Hero button text");
    expect(hero("title")).toBe("Edited Hero title");
    // One text only: no field name, as on the canvas.
    expect(labelFor(edit("text", { field: "text" }), siteLibrary)).toBe("Edited Heading text");
    // A field named like its element isn't repeated: not "Edited Question question".
    expect(
      labelFor(edit("text", { componentType: "FaqItem", field: "question" }), siteLibrary),
    ).toBe("Edited Question text");
  });

  it("says when an edit is to the shared Header or Footer (F-ED-7)", () => {
    const footer = { type: "Footer", props: { id: "f", text: "Bye", layerName: "Small print" } };
    const shared = (extra: Partial<EngineEdit>) =>
      labelFor(
        edit("text", {
          componentType: "Footer",
          nodeId: "f",
          field: "text",
          shared: true,
          layout: { header: [], footer: [footer] },
          ...extra,
        }),
        siteLibrary,
      );

    // Its name in Layers is found in the layout, not the page.
    expect(shared({})).toBe("Edited shared 'Small print' text");
    expect(
      shared({ layout: { header: [], footer: [{ ...footer, props: { id: "f", text: "Bye" } }] } }),
    ).toBe("Edited shared Footer text");
  });

  it("names an element by the name it has in Layers", () => {
    expect(labelFor(edit("text", { nodeId: "h", field: "text", page: named }), siteLibrary)).toBe(
      "Edited 'Opening times' text",
    );
    expect(labelFor(edit("props", { nodeId: "h", field: "size", page: named }), siteLibrary)).toBe(
      "Changed 'Opening times' size",
    );
  });

  it("finds a deleted element's name in the page as it was", () => {
    const after = { ...named, content: [] };

    expect(labelFor(edit("remove", { nodeId: "h", page: after }), siteLibrary, named)).toBe(
      "Deleted 'Opening times'",
    );
  });

  it("ignores a blank Layers name", () => {
    const blank: PageDoc = {
      root: { props: {} },
      content: [{ type: "Heading", props: { id: "h", text: "x", layerName: "  " } }],
    };

    expect(labelFor(edit("move", { nodeId: "h", page: blank }), siteLibrary)).toBe("Moved Heading");
  });

  it("gives every kind of edit its own label (D2)", () => {
    const kinds: Record<EngineEditKind, true> = {
      insert: true,
      move: true,
      remove: true,
      duplicate: true,
      text: true,
      props: true,
      root: true,
      page: true,
    };
    const labels = Object.keys(kinds).map((kind) =>
      labelFor(edit(kind as EngineEditKind, { field: "size" }), siteLibrary),
    );

    for (const label of labels) expect(label).not.toBe("");
    // Only the safety net for unexplained changes uses the generic label.
    expect(labels.filter((label) => label === "Edited page")).toEqual(["Edited page"]);
  });
});
