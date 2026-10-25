/** An open dialog: not one closing, which keeps the focus a moment after its answer. */
const OPEN_DIALOG = ':is([role="dialog"], [role="alertdialog"]):not([data-state="closed"])';

/**
 * The `<input>` types that hold no text: a dialog's undo there is the site's. Every other type is
 * text the person types, `email` and `number` included, whose caret browsers don't report.
 */
const NOT_TEXT: ReadonlySet<string> = new Set([
  "checkbox",
  "radio",
  "range",
  "color",
  "file",
  "button",
  "submit",
  "reset",
  "image",
  "hidden",
]);

/**
 * Whether a key pressed on `target` is a dialog's text's own (#421 review): `target` is a text
 * field (any `<input>` that takes typing, a textarea), a select or editable text in an open dialog,
 * whose undo and redo are its text's. A dialog's other controls (a slider, a swatch) leave
 * Ctrl/Cmd+Z to the site, so a dialog that edits the site as it goes (Theme Studio, P5) undoes it.
 * Duck-typed: a key pressed in the canvas is another window's.
 */
export function isDialogText(target: EventTarget | null): boolean {
  const element = target as {
    closest?: (selector: string) => unknown;
    isContentEditable?: boolean;
    tagName?: string;
    type?: string;
  } | null;
  if (element?.closest?.(OPEN_DIALOG) == null) return false;
  switch (element.tagName) {
    case "INPUT":
      return !NOT_TEXT.has((element.type ?? "text").toLowerCase());
    case "TEXTAREA":
    case "SELECT":
      return true;
    default:
      return element.isContentEditable === true;
  }
}
