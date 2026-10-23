/**
 * Starting to edit an element's text from the keyboard (F-ED-27: Enter edits text, Backspace
 * empties it and starts editing). Puck makes a plain-text field editable only while it is hovered
 * or focused, and rich text (Tiptap) is editable in place, so both are focused the same way: made
 * editable, focused, the caret put at the end. Emptying deletes the text as typing would, so the
 * canvas reports it as the start of the text's editing session: one undo step with what follows.
 */

/** Puck's wrapper around each element on the canvas. */
const ELEMENT = "[data-puck-component]";

/** The canvas's editable text: Puck's plain-text fields and the rich-text editor. */
const TEXT_FIELD = "[contenteditable]";

/** `element`'s own text fields on the canvas, in order: not those of elements inside it. */
function ownTextFields(element: Element): HTMLElement[] {
  return [...element.querySelectorAll<HTMLElement>(TEXT_FIELD)].filter(
    (field) =>
      field.closest(ELEMENT) === element &&
      // Rich text's outer box, when the editor inside it is what takes the text.
      field.querySelector(TEXT_FIELD) === null,
  );
}

/**
 * Starts editing the first text of element `nodeId` in `document`, the caret at its end; with
 * `clear`, its text emptied first. Returns false if it has no text of its own (a Section).
 */
export function startTextEditing(document: Document, nodeId: string, clear: boolean): boolean {
  const element = document.querySelector(`[data-puck-component="${CSS.escape(nodeId)}"]`);
  const [field] = element === null ? [] : ownTextFields(element);
  if (field === undefined) return false;
  // Puck's plain-text field says "false" until it is hovered or focused; focusing keeps it on.
  if (field.getAttribute("contenteditable") === "false") {
    field.setAttribute("contenteditable", "plaintext-only");
  }
  field.focus();
  const selection = document.getSelection();
  if (selection === null) return true;
  const range = document.createRange();
  range.selectNodeContents(field);
  if (clear) {
    selection.removeAllRanges();
    selection.addRange(range);
    // As typing would: an `input` event, which the canvas reports like any other text edit.
    document.execCommand("delete");
    return true;
  }
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}
