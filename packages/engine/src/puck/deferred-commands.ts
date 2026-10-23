import type { HistoryCommandHandler } from "../canvas-engine.js";

/** What {@link deferredCommands} returns to the engine. */
export type DeferredCommands = {
  /** Runs `command`, or holds it back (and returns true) as described on {@link deferredCommands}. */
  readonly run: HistoryCommandHandler;
  /**
   * Runs `action` once the rich text being typed has all arrived, as Undo waits (Alt + Enter's
   * split, which must not leave the last keystrokes out of the step before it).
   */
  whenSent(action: () => void): void;
  /** An edit was just recorded: commands held back run now, in order. */
  edited(): void;
  /** Drops commands still held back (the canvas goes away). */
  dispose(): void;
};

/**
 * Undo and Redo pressed while typing rich text (#146). Puck holds a rich-text editor's last
 * keystrokes back for a moment; `sendPending` asks it to send them now and says whether there were
 * any. If so, the command waits until their edit is recorded (`edited`), so they belong to the
 * session being undone, or `timeoutMs` at most. Undo or Redo pressed meanwhile waits behind it, in
 * order. Esc (`cancel`) never waits.
 *
 * An earlier batch of keystrokes can still be on its way when they are sent, and arrive first: the
 * command then waits on until `settled` says the text being typed has all arrived. Run before it,
 * the Undo would leave the last keystrokes to arrive after it, as a new step.
 */
export function deferredCommands(
  runNow: HistoryCommandHandler,
  sendPending: () => boolean,
  settled: () => boolean,
  timeoutMs: number,
): DeferredCommands {
  let waiting: {
    readonly actions: (() => void)[];
    readonly timer: ReturnType<typeof setTimeout>;
  } | null = null;
  const runWaiting = () => {
    if (waiting === null) {
      return;
    }
    clearTimeout(waiting.timer);
    const { actions } = waiting;
    waiting = null;
    for (const action of actions) action();
  };
  /** Holds `action` back if keystrokes are on their way; true if it did. */
  const holdBack = (action: () => void): boolean => {
    if (waiting !== null) {
      waiting.actions.push(action);
      return true;
    }
    if (sendPending()) {
      waiting = { actions: [action], timer: setTimeout(runWaiting, timeoutMs) };
      return true;
    }
    return false;
  };
  return {
    run(command) {
      if (command !== "cancel" && holdBack(() => runNow(command))) {
        return true;
      }
      return runNow(command);
    },
    whenSent(action) {
      if (!holdBack(action)) action();
    },
    edited() {
      if (waiting === null) return;
      queueMicrotask(() => {
        if (settled()) runWaiting();
      });
    },
    dispose() {
      if (waiting !== null) clearTimeout(waiting.timer);
      waiting = null;
    },
  };
}
