/** An open dialog: not one closing, which keeps the focus a moment after its answer. */
const OPEN_DIALOG = ':is([role="dialog"], [role="alertdialog"]):not([data-state="closed"])';

/**
 * Whether a key pressed on `target` is a dialog's text's own (#421 review): `target` is a text
 * field, a select or editable text in an open dialog, whose undo and redo are its text's. A dialog's
 * other controls (a slider, a swatch) leave Ctrl/Cmd+Z to the site, so a dialog that edits the site
 * as it goes (Theme Studio, P5) undoes it. Duck-typed: a key pressed in the canvas is another
 * window's.
 */
export function isDialogText(target: EventTarget | null): boolean {
  const element = target as {
    closest?: (selector: string) => unknown;
    isContentEditable?: boolean;
    tagName?: string;
    selectionStart?: number | null;
  } | null;
  if (element?.closest?.(OPEN_DIALOG) == null) return false;
  // A text field has a caret (`selectionStart`); a checkbox, a radio or a range has none.
  const textField =
    (element.tagName === "INPUT" || element.tagName === "TEXTAREA") &&
    typeof element.selectionStart === "number";
  return textField || element.tagName === "SELECT" || element.isContentEditable === true;
}
