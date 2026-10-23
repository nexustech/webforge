import { type Editor, Extension, getHTMLFromFragment } from "@tiptap/core";
import type { RichTextLink } from "@webforge/model";

/** Asks for a link for the rich text being edited: undefined to leave it, null to remove it. */
export type PickLink = (current: RichTextLink | null) => Promise<RichTextLink | null | undefined>;

/**
 * Links the selected text, or changes the link at the caret, with what `pick` answers (F-ED-18):
 * the link button and Mod + K both do this.
 */
export async function pickLinkInto(editor: Editor, pick: PickLink): Promise<void> {
  const { href, target } = editor.getAttributes("link");
  const current = typeof href === "string" ? { href, newTab: target === "_blank" } : null;
  const next = await pick(current);
  const chain = editor.chain().focus().extendMarkRange("link");
  if (next === null) {
    chain.unsetLink().run();
  } else if (next !== undefined) {
    chain.setLink({ href: next.href, target: next.newTab ? "_blank" : null }).run();
  } else {
    chain.run();
  }
}

/** Rich text split at the caret: what stays in the element, and what goes into a new one after it. */
export type TextHalves = { readonly before: string; readonly after: string };

/**
 * The rich text of `editor` split at its selection, as HTML: what comes before it and what comes
 * after (a selection itself goes, as typing over it would). Lists and paragraphs cut at the caret
 * stay whole on both sides.
 */
export function splitAtSelection(editor: Editor): TextHalves {
  const { doc, selection, schema } = editor.state;
  return {
    before: getHTMLFromFragment(doc.cut(0, selection.from).content, schema),
    after: getHTMLFromFragment(doc.cut(selection.to).content, schema),
  };
}

/** What the keys in rich text ask of the engine. */
export type TextKeyHandlers = {
  /** The link picker, or null while the app picks none. */
  readonly pickLink: () => PickLink | null;
  /** Splits the element being edited in two (Alt + Enter). */
  readonly split: (halves: TextHalves) => void;
};

/**
 * The keys of F-ED-27 that only rich text has (Bootstrap Studio's): Mod + K links the selected text
 * (as the toolbar's link button does), Alt + Enter splits the element in two at the caret, and
 * Shift + Space types a non-breaking space. Shift + Enter's new line is the editor's own.
 */
export function createTextKeys(handlers: TextKeyHandlers) {
  return Extension.create({
    name: "webforgeTextKeys",
    addKeyboardShortcuts() {
      return {
        "Shift-Space": ({ editor }) => editor.commands.insertContent(" "),
        "Mod-k": ({ editor }) => {
          const pick = handlers.pickLink();
          // Without text selected or a link to change, there's nothing to link: the key is still
          // the text's, not the command palette's.
          if (pick !== null && (!editor.state.selection.empty || editor.isActive("link"))) {
            void pickLinkInto(editor, pick);
          }
          return true;
        },
        "Alt-Enter": ({ editor }) => {
          handlers.split(splitAtSelection(editor));
          return true;
        },
      };
    },
  });
}
