// @vitest-environment happy-dom

import type { PageDoc } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { focusedRichTextId, richTextArrived, staleRichText } from "./stale-rich-text.js";

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
    expect(staleRichText(library, page("1", "2"), page("1", "3"))).toEqual(["b"]);
    expect(staleRichText(library, page("1", "2"), page("1", "2", "other"))).toEqual([]);
  });

  it("treats new nodes as changed", () => {
    const before: PageDoc = { root: { props: {} }, content: [] };

    expect(staleRichText(library, before, page("1", "2"))).toEqual(["a", "b"]);
  });

  it("includes the node the user is typing in: Undo while typing must show (#146)", () => {
    expect(staleRichText(library, page("1", "2"), page("9", "9"))).toEqual(["a", "b"]);
  });

  it("finds the node whose rich-text editor has the focus", () => {
    document.body.innerHTML =
      '<div data-puck-component="a"><div class="ProseMirror" contenteditable="true" tabindex="0" id="editor"></div></div>' +
      '<div data-puck-component="b"><input id="plain"></div>';
    document.getElementById("editor")?.focus();
    expect(focusedRichTextId(document)).toBe("a");

    document.getElementById("plain")?.focus();
    expect(focusedRichTextId(document)).toBeNull();
    expect(focusedRichTextId(null)).toBeNull();
  });

  it("says whether the focused editor's text has all reached the page (#146)", () => {
    document.body.innerHTML =
      '<div data-puck-component="a"><div class="ProseMirror" contenteditable="true" tabindex="0" id="editor"></div></div>' +
      '<div data-puck-component="b"><input id="plain"></div>';
    const element = document.getElementById("editor");
    let html = "<p>1 and more</p>";
    Object.assign(element ?? {}, { editor: { getHTML: () => html } });
    element?.focus();

    expect(richTextArrived(document, page("<p>1</p>", "2"), "body")).toBe(false);
    expect(richTextArrived(document, page("<p>1 and more</p>", "2"), "body")).toBe(true);
    html = "<p>1 and more!</p>";
    expect(richTextArrived(document, page("<p>1 and more</p>", "2"), "body")).toBe(false);
    // No rich text has the focus: nothing is on its way.
    document.getElementById("plain")?.focus();
    expect(richTextArrived(document, page("<p>1</p>", "2"), "body")).toBe(true);
    expect(richTextArrived(null, page("<p>1</p>", "2"), "body")).toBe(true);
  });

  it("compares the focused field's own value, an emptied editor as no text", () => {
    document.body.innerHTML =
      '<div data-puck-component="a"><div class="ProseMirror" contenteditable="true" tabindex="0" id="editor"></div></div>';
    const element = document.getElementById("editor");
    let html = "t";
    Object.assign(element ?? {}, { editor: { getHTML: () => html } });
    element?.focus();

    // The same text in another field of the element isn't this one's.
    expect(richTextArrived(document, page("<p>1</p>", "2", "t"), "body")).toBe(false);
    // A field Puck names by a path inside the props: any of them.
    expect(richTextArrived(document, page("<p>1</p>", "2", "t"), "items[0].body")).toBe(true);
    // Emptied: the editor says `<p></p>`, the page may say "".
    html = "<p></p>";
    expect(richTextArrived(document, page("", "2"), "body")).toBe(true);
  });
});
