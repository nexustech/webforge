import { COMPONENT, COMPONENT_ATTRIBUTE } from "./puck-dom.js";
import { startTextEditing } from "./text-editing.js";

/**
 * Typing starts editing (LF-17, #1178): with an element selected whose own content is text, a key
 * that types a character starts editing its text with that character, the caret at the end, as
 * Enter starts it. A key that types nothing, or a selection with no text of its own (a Section, an
 * image), is left to the shortcuts: `?` still opens the shortcut sheet there.
 */

/** What {@link startEditingOnType} asks about the canvas's selection. */
export type TypeToEditOptions = {
  /** The element selected, if one is. */
  readonly selected: () => string | null;
  /** Whether several elements are selected: text is one element's (1.31). */
  readonly several: () => boolean;
};

/** A key press, as {@link typedCharacter} reads it. */
type KeyPress = Pick<
  KeyboardEvent,
  "key" | "ctrlKey" | "metaKey" | "altKey" | "repeat" | "isComposing"
> & {
  readonly getModifierState?: KeyboardEvent["getModifierState"];
};

/**
 * The character `event` types, if it types one: a single character, not Space (which picks up an
 * element to move it from the keyboard), with neither Ctrl, Cmd nor Alt, unless AltGr typed it
 * (Windows reports AltGr as Ctrl+Alt). None while an input method is composing, or for a held key's
 * repeats.
 */
export function typedCharacter(event: KeyPress): string | undefined {
  if (event.repeat || event.isComposing || [...event.key].length !== 1 || event.key === " ") {
    return undefined;
  }
  const altGr = event.getModifierState?.("AltGraph") === true;
  if ((event.ctrlKey || event.metaKey || event.altKey) && !altGr) return undefined;
  return event.key;
}

/** Whether a key press at `target` already goes to something that takes typing. */
function takesTyping(target: EventTarget | null): boolean {
  const element = target as { isContentEditable?: boolean; tagName?: string } | null;
  return (
    element?.isContentEditable === true ||
    element?.tagName === "INPUT" ||
    element?.tagName === "TEXTAREA" ||
    element?.tagName === "SELECT"
  );
}

/**
 * Starts editing the selected element's text in `frame`, the canvas's window: when a character is
 * typed, before the app's shortcuts see the key, and when its text is pressed again, with the caret
 * where it's pressed. Returns what stops it.
 */
export function startEditingOnType(frame: Window, options: TypeToEditOptions): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || takesTyping(event.target)) return;
    const character = typedCharacter(event);
    const id = options.selected();
    if (character === undefined || id === null || options.several()) return;
    if (!startTextEditing(frame.document, id, false)) return;
    // The key itself types the character, into the text that now has the focus and the caret: the
    // canvas reports it as the start of the text's editing session, one undo step with what
    // follows. No shortcut sees it (`?` types a question mark here).
    event.stopPropagation();
  };
  // A press on the selected element's own plain text makes it editable before the press lands, so
  // the press puts the caret where it is: Puck makes it editable only once the pointer's hover has
  // been drawn, and a quick click would focus the element instead.
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }
    // The canvas iframe's elements aren't this window's `Element`: duck-typed.
    const target = event.target as Partial<Element> | null;
    const field = target?.closest?.("[contenteditable]");
    const id = options.selected();
    if (field === null || field === undefined || id === null || options.several()) return;
    if (field.getAttribute("contenteditable") !== "false") return;
    if (field.closest(COMPONENT)?.getAttribute(COMPONENT_ATTRIBUTE) !== id) return;
    field.setAttribute("contenteditable", "plaintext-only");
  };
  frame.addEventListener("keydown", onKeyDown, { capture: true });
  frame.addEventListener("pointerdown", onPointerDown, { capture: true });
  return () => {
    frame.removeEventListener("keydown", onKeyDown, { capture: true });
    frame.removeEventListener("pointerdown", onPointerDown, { capture: true });
  };
}
