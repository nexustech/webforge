import type { HistoryCommand, HistoryCommandHandler, Unsubscribe } from "./canvas-engine.js";

type KeyInfo = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">;

/**
 * The history command for a key press: Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y redo
 * (U4), Esc cancels a gesture. Uses the produced character, so it follows the keyboard layout
 * (Ctrl+Z on AZERTY too).
 */
export function historyCommandFor(event: KeyInfo): HistoryCommand | null {
  if (event.key === "Escape") {
    return event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ? null : "cancel";
  }
  if (!(event.ctrlKey || event.metaKey) || event.altKey) {
    return null;
  }
  const key = event.key.toLowerCase();
  if (key === "z") {
    return event.shiftKey ? "redo" : "undo";
  }
  if (key === "y" && !event.shiftKey) {
    return "redo";
  }
  return null;
}

const NATIVE_HISTORY: Readonly<Record<string, HistoryCommand>> = {
  historyUndo: "undo",
  historyRedo: "redo",
};

/** Options of {@link installHistoryKeys}. */
type HistoryKeysOptions = {
  /**
   * Whether `event` belongs to something else that has the keys, such as a dialog over the page:
   * its undo is its own text's, and its Esc closes it.
   */
  readonly ignore?: (event: Event) => boolean;
};

/**
 * Routes every undo/redo gesture in `target` (a window, or a canvas iframe's window) to
 * `onCommand`, before anything else sees it: Puck's own history hotkeys, the rich-text editor and
 * the browser's native `contenteditable` undo (research/stack/03-undo-redo.md rules 5 and 6).
 * Esc goes to `onCommand` first too, but reaches the rest of the page unless it cancelled something.
 * Gestures `ignore` names are left alone.
 */
export function installHistoryKeys(
  target: Window,
  onCommand: HistoryCommandHandler,
  { ignore = () => false }: HistoryKeysOptions = {},
): Unsubscribe {
  const onKeyDown = (event: KeyboardEvent) => {
    const command = historyCommandFor(event);
    if (command === null || ignore(event)) {
      return;
    }
    if (command === "cancel") {
      if (onCommand(command) === true) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    // Holding the keys repeats, as in word processors.
    onCommand(command);
  };
  const onBeforeInput = (event: InputEvent) => {
    const command = NATIVE_HISTORY[event.inputType];
    if (command === undefined || ignore(event)) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    onCommand(command);
  };
  target.addEventListener("keydown", onKeyDown, { capture: true });
  target.addEventListener("beforeinput", onBeforeInput, { capture: true });
  return () => {
    target.removeEventListener("keydown", onKeyDown, { capture: true });
    target.removeEventListener("beforeinput", onBeforeInput, { capture: true });
  };
}
