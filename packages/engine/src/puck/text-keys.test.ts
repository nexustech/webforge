// @vitest-environment happy-dom
import { Editor, Mark, Node } from "@tiptap/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTextKeys, splitAtSelection, type TextKeyHandlers } from "./text-keys.js";

// The smallest schema rich text has: paragraphs of text (Puck's editor adds the formatting).
const Doc = Node.create({ name: "doc", topNode: true, content: "block+" });
const Paragraph = Node.create({
  name: "paragraph",
  group: "block",
  content: "inline*",
  parseHTML: () => [{ tag: "p" }],
  renderHTML: () => ["p", 0],
});
const Text = Node.create({ name: "text", group: "inline" });
// Links, for the link key to find (Puck's editor has the real extension).
const Link = Mark.create({
  name: "link",
  addAttributes: () => ({ href: { default: null }, target: { default: null } }),
  parseHTML: () => [{ tag: "a[href]" }],
  renderHTML: ({ HTMLAttributes }) => ["a", HTMLAttributes, 0],
});

let editor: Editor | undefined;
afterEach(() => editor?.destroy());

function editorWith(content: string, handlers: Partial<TextKeyHandlers> = {}) {
  const split = vi.fn();
  const pickLink = vi.fn(() => null);
  editor = new Editor({
    extensions: [Doc, Paragraph, Text, Link, createTextKeys({ split, pickLink, ...handlers })],
    content,
  });
  return { editor, split, pickLink };
}

describe("text keys (F-ED-27)", () => {
  it("splits the text at the caret, keeping paragraphs whole on both sides", () => {
    const { editor } = editorWith("<p>Opening times</p><p>Every day</p>");
    // After "Opening " (the paragraph starts at 1).
    editor.commands.setTextSelection(9);

    expect(splitAtSelection(editor)).toEqual({
      before: "<p>Opening </p>",
      after: "<p>times</p><p>Every day</p>",
    });
    // A selection goes, as typing over it would.
    editor.commands.setTextSelection({ from: 1, to: 9 });
    expect(splitAtSelection(editor)).toEqual({
      before: "<p></p>",
      after: "<p>times</p><p>Every day</p>",
    });
  });

  it("asks for a split on Alt+Enter, and changes nothing itself", () => {
    const { editor, split } = editorWith("<p>Opening times</p>");
    editor.commands.setTextSelection(9);

    expect(editor.commands.keyboardShortcut("Alt-Enter")).toBe(true);

    expect(split).toHaveBeenCalledExactlyOnceWith({
      before: "<p>Opening </p>",
      after: "<p>times</p>",
    });
    expect(editor.getHTML()).toBe("<p>Opening times</p>");
  });

  it("types a non-breaking space on Shift+Space", () => {
    const { editor } = editorWith("<p>10am</p>");
    editor.commands.setTextSelection(3);

    editor.commands.keyboardShortcut("Shift-Space");

    expect(editor.getText()).toBe("10 am");
  });

  it("asks for a link on Mod+K with text selected, and keeps the key from the palette either way", () => {
    const pick = vi.fn(async () => undefined);
    const { editor } = editorWith("<p>Opening times</p>", { pickLink: () => pick });

    // Nothing selected and no link: nothing to link.
    editor.commands.setTextSelection(3);
    expect(editor.commands.keyboardShortcut("Mod-k")).toBe(true);
    expect(pick).not.toHaveBeenCalled();

    editor.commands.setTextSelection({ from: 1, to: 8 });
    expect(editor.commands.keyboardShortcut("Mod-k")).toBe(true);
    expect(pick).toHaveBeenCalledExactlyOnceWith(null);
  });

  it("keeps Mod+K the text's when the app picks no links", () => {
    const { editor, pickLink } = editorWith("<p>Opening times</p>");
    editor.commands.setTextSelection({ from: 1, to: 8 });

    expect(editor.commands.keyboardShortcut("Mod-k")).toBe(true);
    expect(pickLink).toHaveBeenCalledOnce();
  });
});
