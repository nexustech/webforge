import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { looksLikeMarkdown, markdownToRichText } from "@webforge/model";

/**
 * Pasting Markdown into text on the canvas (6.10b, BS9-4): plain text that reads as Markdown (a
 * heading, a list, bold, a link) is pasted as the formatting it stands for, as rich text has it,
 * so a post drafted elsewhere keeps its shape. Text with formatting of its own (from Word or a web
 * page) and plain sentences are pasted as before; undo takes the paste back as one step.
 */
export const MarkdownPaste = Extension.create({
  name: "webforgeMarkdownPaste",
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey("webforgeMarkdownPaste"),
        props: {
          handlePaste: (_view, event) => {
            const data = event.clipboardData;
            if (data === null || data.getData("text/html") !== "") return false;
            const text = data.getData("text/plain");
            if (text === "" || !looksLikeMarkdown(text)) return false;
            const html = markdownToRichText(text);
            if (html === "") return false;
            return editor.commands.insertContent(html);
          },
        },
      }),
    ];
  },
});
