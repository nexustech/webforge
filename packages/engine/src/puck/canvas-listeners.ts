import type { CanvasContextMenu, HistoryCommandHandler } from "../canvas-engine.js";
import { installHistoryKeys } from "../history-keys.js";
import { installMenuKeys } from "../menu-keys.js";
import { keepCanvasOnPage } from "./canvas-navigation.js";
import { installContextMenu } from "./context-menu.js";
import { hidePuckDeleteKeys } from "./delete-keys.js";
import { type DragKeys, trackDragKeys } from "./drag-copies.js";
import { type TypingPauses, timeKeystrokes } from "./typing-pauses.js";

/** What the canvas's keys, clicks and menus report to, and ask, in a window. */
export type CanvasListenerOptions = {
  /** The keys held while dragging (Ctrl or Cmd copies, see `drag-copies.ts`). */
  readonly dragKeys: DragKeys;
  /** Watches clicks that add to the selection in a window (see `selection-clicks.ts`). */
  readonly watchClicks: (target: Window) => () => void;
};

/** What the canvas's own document also reports to, and asks. */
export type FrameListenerOptions = CanvasListenerOptions & {
  /** Runs Undo, Redo and Esc's cancel (see `installHistoryKeys`). */
  readonly runCommand: HistoryCommandHandler;
  /** Times the keys typed on the canvas, which splits typing into undo chunks (#307). */
  readonly pauses: TypingPauses;
  /** Reports the element menu asked for on the canvas (1.35). */
  readonly contextMenu: (menu: CanvasContextMenu) => void;
  /** Whether the element menu opens: not in Content mode, where right-clicks get the browser's. */
  readonly menuEnabled: () => boolean;
  /** The element selected now, whose menu the keyboard asks for. */
  readonly selected: () => string | null;
};

/**
 * Listens in the editor window `target`, around a canvas without an iframe: Delete and Backspace
 * kept from Puck (see `delete-keys.ts`), the keys held while dragging, and clicks that add to the
 * selection. Returns what stops it.
 */
export function listenInEditor(target: Window, options: CanvasListenerOptions): () => void {
  const stops = [
    hidePuckDeleteKeys(target),
    trackDragKeys(target, options.dragKeys),
    options.watchClicks(target),
  ];
  return () => {
    for (const stop of stops) stop();
  };
}

/**
 * Listens in the canvas iframe's window `frame`: as in the editor window, plus Undo and Redo from
 * the keyboard (taken before Puck's own hotkeys, ADR 0004), and the element menu from a right-click
 * or the keyboard, Shift+F10 on macOS too (#287), the time of each key typed (#307), and its links
 * and forms followed nowhere. Returns what stops it.
 */
export function listenInFrame(frame: Window, options: FrameListenerOptions): () => void {
  const stops = [
    listenInEditor(frame, options),
    installHistoryKeys(frame, options.runCommand),
    timeKeystrokes(frame, options.pauses),
    installContextMenu(frame.document, options.contextMenu, {
      enabled: options.menuEnabled,
      selected: options.selected,
    }),
    installMenuKeys(frame.document),
    keepCanvasOnPage(frame.document),
  ];
  return () => {
    for (const stop of stops) stop();
  };
}
