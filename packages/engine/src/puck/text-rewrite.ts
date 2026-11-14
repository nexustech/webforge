import type { Editor, JSONContent } from "@tiptap/core";
import type { RewriteHow, RewriteRequest } from "../canvas-engine.js";

/**
 * Asks the app to rewrite the selected text (G25a, #873): the text the person accepted, or
 * `undefined` to leave it.
 */
export type Rewrite = (request: Omit<RewriteRequest, "at">) => Promise<string | undefined>;

/** How paragraphs are told apart in the text a rewrite reads and gives back. */
const PARAGRAPH_BREAK = "\n\n";

/** `text`'s paragraphs, each on one line, as the editor's content: a run of text for just one. */
function contentOf(text: string): JSONContent | JSONContent[] | undefined {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter((paragraph) => paragraph !== "");
  if (paragraphs.length <= 1) {
    return paragraphs[0] === undefined ? undefined : { type: "text", text: paragraphs[0] };
  }
  return paragraphs.map((paragraph) => ({
    type: "paragraph",
    content: [{ type: "text", text: paragraph }],
  }));
}

/**
 * Rewrites the text selected in `editor` as `how` says, with what `rewrite` answers (#873): the
 * answer replaces the selection, as plain text, once the person has accepted it. Nothing changes if
 * they didn't, or if the text there changed while they read it. True if it was replaced.
 */
export async function rewriteSelection(
  editor: Editor,
  how: RewriteHow,
  rewrite: Rewrite,
): Promise<boolean> {
  const { from, to, empty } = editor.state.selection;
  if (empty) return false;
  const text = editor.state.doc.textBetween(from, to, PARAGRAPH_BREAK);
  if (text.trim() === "") return false;
  let formatted = false;
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (node.marks.length > 0) formatted = true;
  });
  const next = await rewrite({ how, text, formatted });
  const content = next === undefined ? undefined : contentOf(next);
  if (content === undefined || editor.isDestroyed) return false;
  const { doc } = editor.state;
  if (to > doc.content.size || doc.textBetween(from, to, PARAGRAPH_BREAK) !== text) return false;
  return editor.chain().focus().insertContentAt({ from, to }, content).run();
}
