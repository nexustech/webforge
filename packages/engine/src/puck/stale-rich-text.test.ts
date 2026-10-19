// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { PageDoc } from "../canvas-engine.js";
import type { ComponentLibrary } from "../library.js";
import { staleRichText } from "./stale-rich-text.js";

const library: ComponentLibrary = {
  components: {
    Text: {
      label: "Text",
      fields: { body: { kind: "richtext", label: "Body" }, title: { kind: "text", label: "T" } },
      defaults: {},
      render: () => null,
    },
  },
};

const page = (a: string, b: string, title = "t"): PageDoc => ({
  root: { props: {} },
  content: [
    { type: "Text", props: { id: "a", body: a, title } },
    { type: "Text", props: { id: "b", body: b } },
    { type: "Unknown", props: { id: "u", body: "x" } },
  ],
});

describe("staleRichText", () => {
  it("lists nodes whose rich text changed", () => {
    expect(staleRichText(library, page("1", "2"), page("1", "3"), null)).toEqual(["b"]);
    expect(staleRichText(library, page("1", "2"), page("1", "2", "other"), null)).toEqual([]);
  });

  it("treats new nodes as changed", () => {
    const before: PageDoc = { root: { props: {} }, content: [] };

    expect(staleRichText(library, before, page("1", "2"), null)).toEqual(["a", "b"]);
  });

  it("skips the node the user is typing in", () => {
    document.body.innerHTML =
      '<div data-puck-component="a"><div contenteditable="true" tabindex="0" id="editor"></div></div>';
    document.getElementById("editor")?.focus();

    expect(staleRichText(library, page("1", "2"), page("9", "9"), document)).toEqual(["b"]);
  });
});
