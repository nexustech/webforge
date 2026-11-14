// @vitest-environment happy-dom
import { Editor, Mark, Node } from "@tiptap/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Rewrite, rewriteSelection } from "./text-rewrite.js";

// The smallest schema rich text has: paragraphs of text, and bold for formatting.
const Doc = Node.create({ name: "doc", topNode: true, content: "block+" });
const Paragraph = Node.create({
  name: "paragraph",
  group: "block",
  content: "inline*",
  parseHTML: () => [{ tag: "p" }],
  renderHTML: () => ["p", 0],
});
const Text = Node.create({ name: "text", group: "inline" });
const Bold = Mark.create({
  name: "bold",
  parseHTML: () => [{ tag: "strong" }],
  renderHTML: () => ["strong", 0],
});

let editor: Editor | undefined;
afterEach(() => editor?.destroy());

function editorWith(content: string) {
  editor = new Editor({ extensions: [Doc, Paragraph, Text, Bold], content });
  return editor;
}

describe("rewriting selected text (G25a, #873)", () => {
  it("asks with the selection as plain text and puts the accepted text in its place", async () => {
    const editor = editorWith("<p>We are open from nine until five.</p>");
    // "open from nine until five" (the paragraph starts at 1).
    editor.commands.setTextSelection({ from: 8, to: 33 });
    const applying = vi.fn();
    const rewrite = vi.fn<Rewrite>(async () => ({ text: "open 9 to 5", applying }));

    expect(await rewriteSelection(editor, "shorter", rewrite)).toBe(true);
    expect(rewrite).toHaveBeenCalledWith({
      how: "shorter",
      text: "open from nine until five",
      formatted: false,
    });
    expect(editor.getHTML()).toBe("<p>We are open 9 to 5.</p>");
    expect(applying).toHaveBeenCalledOnce();
  });

  it("reads paragraphs apart and gives each answered paragraph its own", async () => {
    const editor = editorWith("<p>First <strong>one</strong>.</p><p>Second one.</p>");
    editor.commands.selectAll();
    const rewrite = vi.fn<Rewrite>(async () => ({ text: "Number one.\n\nNumber\ntwo.\n\n\n" }));

    await rewriteSelection(editor, "friendlier", rewrite);
    expect(rewrite).toHaveBeenCalledWith({
      how: "friendlier",
      text: "First one.\n\nSecond one.",
      formatted: true,
    });
    expect(editor.getHTML()).toBe("<p>Number one.</p><p>Number two.</p>");
  });

  it("changes nothing when the person cancels, or when the text changed meanwhile", async () => {
    const editor = editorWith("<p>Open daily.</p>");
    editor.commands.setTextSelection({ from: 1, to: 11 });
    expect(await rewriteSelection(editor, "grammar", async () => undefined)).toBe(false);
    expect(editor.getHTML()).toBe("<p>Open daily.</p>");

    // The app prepares no undo step for a rewrite that doesn't go in (#1049's review).
    const applying = vi.fn();
    const late: Rewrite = async () => {
      editor.commands.insertContentAt(1, "Now ");
      return { text: "Open every day.", applying };
    };
    expect(await rewriteSelection(editor, "grammar", late)).toBe(false);
    expect(editor.getHTML()).toBe("<p>Now Open daily.</p>");
    expect(applying).not.toHaveBeenCalled();
  });

  it("asks nothing without text selected", async () => {
    const editor = editorWith("<p>Open daily.</p>");
    editor.commands.setTextSelection(3);
    const rewrite = vi.fn<Rewrite>();
    expect(await rewriteSelection(editor, "shorter", rewrite)).toBe(false);
    expect(rewrite).not.toHaveBeenCalled();
  });
});
