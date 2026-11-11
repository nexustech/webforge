// @vitest-environment happy-dom
import { Editor, Mark, Node } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { MarkdownPaste } from "./markdown-paste.js";

// Paragraphs, bold and lists: enough of rich text's schema to see the paste's formatting.
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
const BulletList = Node.create({
  name: "bulletList",
  group: "block",
  content: "listItem+",
  parseHTML: () => [{ tag: "ul" }],
  renderHTML: () => ["ul", 0],
});
const ListItem = Node.create({
  name: "listItem",
  content: "paragraph+",
  parseHTML: () => [{ tag: "li" }],
  renderHTML: () => ["li", 0],
});

let editor: Editor | undefined;
afterEach(() => editor?.destroy());

/** Pastes `text` (and `html`, as a page or Word gives it) at the end of an empty paragraph. */
function paste(text: string, html = ""): string {
  editor = new Editor({
    extensions: [Doc, Paragraph, Text, Bold, BulletList, ListItem, MarkdownPaste],
    content: "<p></p>",
  });
  const data = new DataTransfer();
  data.setData("text/plain", text);
  if (html !== "") data.setData("text/html", html);
  const event = new ClipboardEvent("paste", { clipboardData: data });
  const handled = editor.view.someProp("handlePaste", (handle) =>
    handle(editor?.view as never, event, editor?.state.doc.slice(0) as never),
  );
  return handled === true ? editor.getHTML() : "(as before)";
}

describe("pasting Markdown (6.10b, BS9-4)", () => {
  it("pastes Markdown as its formatting", () => {
    expect(paste("Open **daily**\n\n- Bread\n- Cakes")).toBe(
      "<p>Open <strong>daily</strong></p><ul><li><p>Bread</p></li><li><p>Cakes</p></li></ul>",
    );
  });

  it("leaves plain sentences and formatted text to the editor's own paste", () => {
    expect(paste("Just a sentence.")).toBe("(as before)");
    expect(paste("**bold**", "<p><b>bold</b></p>")).toBe("(as before)");
  });
});
