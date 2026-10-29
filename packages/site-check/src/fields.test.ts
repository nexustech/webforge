import type { Catalogue } from "@webforge/site-components/catalogue-data";
import { describe, expect, it } from "vitest";
import { eachFieldValue } from "./fields.js";
import { siteWith } from "./test-site.test-helper.js";

/** A component with a text field, a list of items with text, and another text field after it. */
const catalogue = {
  Plan: {
    label: "Plan",
    fields: {
      title: { kind: "text", label: "Title" },
      items: { kind: "list", label: "Items", fields: { text: { kind: "text", label: "Text" } } },
      note: { kind: "text", label: "Note" },
      image: { kind: "media", label: "Image" },
    },
    defaults: {},
  },
} as unknown as Catalogue;

describe("eachFieldValue (#628)", () => {
  it("visits the fields of the kinds asked for in the component's order, list items in place", () => {
    const site = siteWith([
      {
        type: "Plan",
        props: {
          id: "p",
          title: "Small",
          items: [{ text: "One" }, { text: "Two" }],
          note: "Per month",
          image: { mediaId: "m" },
        },
      },
    ]);
    const seen: string[] = [];

    eachFieldValue({ site, catalogue }, ["text"], (placed) => seen.push(placed.field));

    expect(seen).toEqual(["title", "items.0.text", "items.1.text", "note"]);
    // Asked again for another kind, its own plan: nothing of the text kind.
    const media: string[] = [];
    eachFieldValue({ site, catalogue }, ["media"], (placed) => media.push(placed.field));
    expect(media).toEqual(["image"]);
  });
});
