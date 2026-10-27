// @vitest-environment happy-dom
import { Editor, Node } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { markRoles, ThemeColor, ThemeHighlight } from "./text-marks.js";

// The smallest schema rich text has: paragraphs of text, and the two marks under test.
const Doc = Node.create({ name: "doc", topNode: true, content: "block+" });
const Paragraph = Node.create({
  name: "paragraph",
  group: "block",
  content: "inline*",
  parseHTML: () => [{ tag: "p" }],
  renderHTML: () => ["p", 0],
});
const Text = Node.create({ name: "text", group: "inline" });

let editor: Editor | undefined;
afterEach(() => editor?.destroy());

function editorWith(content: string) {
  editor = new Editor({ extensions: [Doc, Paragraph, Text, ThemeHighlight, ThemeColor], content });
  return editor;
}

describe("text marks (2.25, ST-3)", () => {
  it("writes a highlight and a text colour as the theme role's class, never a style", () => {
    const editor = editorWith("<p>Fresh bread daily</p>");
    // "bread" (the paragraph starts at 1).
    editor
      .chain()
      .setTextSelection({ from: 7, to: 12 })
      .setMark("themeHighlight", { role: "accent" })
      .run();
    editor
      .chain()
      .setTextSelection({ from: 13, to: 18 })
      .setMark("themeColor", { role: "brand" })
      .run();

    expect(editor.getHTML()).toBe(
      '<p>Fresh <span class="bg-secondary/30">bread</span> <span class="text-primary">daily</span></p>',
    );
    editor.chain().setTextSelection({ from: 7, to: 12 }).unsetMark("themeHighlight").run();
    expect(editor.getHTML()).toBe('<p>Fresh bread <span class="text-primary">daily</span></p>');
  });

  it("reads back what it wrote, and nothing pasted with colours or classes of its own", () => {
    const editor = editorWith(
      '<p><span class="bg-primary/20">Ours</span> <span class="text-base-content">too</span> ' +
        '<span style="color: red">Word</span> <span class="text-red-500">web</span></p>',
    );

    expect(editor.getHTML()).toBe(
      '<p><span class="bg-primary/20">Ours</span> <span class="text-base-content">too</span> Word web</p>',
    );
  });

  it("offers Surface as a highlight only: as a text colour it would hide the text on the page", () => {
    expect(markRoles("themeHighlight")).toEqual(["brand", "accent", "text", "surface"]);
    expect(markRoles("themeColor")).toEqual(["brand", "accent", "text"]);
    const editor = editorWith(
      '<p><span class="bg-base-200">Soft</span> <span class="text-base-100">gone</span> ' +
        '<span class="">empty</span></p>',
    );

    expect(editor.getHTML()).toBe('<p><span class="bg-base-200">Soft</span> gone empty</p>');
  });
});
