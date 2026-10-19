import type { HistoryCommand, Unsubscribe } from "./canvas-engine.js";

type KeyInfo = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">;

/**
 * The history command for a key press: Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y redo
 * (U4). Uses the produced character, so it follows the keyboard layout (Ctrl+Z on AZERTY too).
 */
export function historyCommandFor(event: KeyInfo): HistoryCommand | null {
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

/**
 * Routes every undo/redo gesture in `target` (a window, or a canvas iframe's window) to
 * `onCommand`, before anything else sees it: Puck's own history hotkeys, the rich-text editor and
 * the browser's native `contenteditable` undo (research/stack/03-undo-redo.md rules 5 and 6).
 */
export function installHistoryKeys(
  target: Window,
  onCommand: (command: HistoryCommand) => void,
): Unsubscribe {
  const onKeyDown = (event: KeyboardEvent) => {
    const command = historyCommandFor(event);
    if (command === null) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    // Holding the keys repeats, as in word processors.
    onCommand(command);
  };
  const onBeforeInput = (event: InputEvent) => {
    const command = NATIVE_HISTORY[event.inputType];
    if (command === undefined) {
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
