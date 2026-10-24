import type { LinkPicker, RichTextAt, TextSplit } from "../canvas-engine.js";
import type { PuckHandle } from "./engine-support.js";
import { createFormatToolbar } from "./rich-text.js";
import { createTextKeys, type PickLink } from "./text-keys.js";

/**
 * The rich-text field being edited in Puck (`puck`): the selected element, and the inline field
 * Puck has focused (`text::inline`).
 */
export function editingRichText(puck: PuckHandle): RichTextAt | null {
  const state = puck();
  const nodeId = state?.selectedItem?.props.id;
  const focus = state?.appState.ui.field.focus;
  return typeof nodeId === "string" && typeof focus === "string"
    ? { nodeId, field: focus.replace(/::inline$/, "") }
    : null;
}

/**
 * What rich text on the canvas gets beyond Puck's own (F-ED-18, F-ED-27): the format toolbar, with
 * links picked by the app's picker once it gives one, and the keys Mod + K, Alt + Enter and
 * Shift + Space. A split (Alt + Enter) is reported through `split` once `whenSent` says the last
 * keystrokes Puck still held back have gone, so the step before it has them and undoing the split
 * gives back all that was typed.
 */
export function createRichTextTools(
  puck: PuckHandle,
  split: (split: TextSplit) => void,
  whenSent: (run: () => void) => void,
) {
  /** Picks links for the format toolbar; none until the app gives one. */
  let linkPicker: LinkPicker | null = null;
  // Read when the toolbar's Link button is clicked, before the dialog takes focus.
  const pickLink = (): PickLink | null => {
    const picker = linkPicker;
    return picker === null ? null : (current) => picker(current, editingRichText(puck));
  };
  return {
    tools: {
      toolbar: createFormatToolbar(pickLink),
      extensions: [
        createTextKeys({
          pickLink,
          split: (halves) => {
            const at = editingRichText(puck);
            if (at !== null) whenSent(() => split({ ...at, ...halves }));
          },
        }),
      ],
    },
    setLinkPicker(picker: LinkPicker | null) {
      linkPicker = picker;
    },
  };
}
