import type { HistoryCommand, HistoryCommandHandler } from "../canvas-engine.js";

/** What {@link deferredCommands} returns to the engine. */
export type DeferredCommands = {
  /** Runs `command`, or holds it back (and returns true) as described on {@link deferredCommands}. */
  readonly run: HistoryCommandHandler;
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
 */
export function deferredCommands(
  runNow: HistoryCommandHandler,
  sendPending: () => boolean,
  timeoutMs: number,
): DeferredCommands {
  let waiting: {
    readonly commands: HistoryCommand[];
    readonly timer: ReturnType<typeof setTimeout>;
  } | null = null;
  const runWaiting = () => {
    if (waiting === null) {
      return;
    }
    clearTimeout(waiting.timer);
    const { commands } = waiting;
    waiting = null;
    for (const command of commands) runNow(command);
  };
  return {
    run(command) {
      if (command !== "cancel") {
        if (waiting !== null) {
          waiting.commands.push(command);
          return true;
        }
        if (sendPending()) {
          waiting = { commands: [command], timer: setTimeout(runWaiting, timeoutMs) };
          return true;
        }
      }
      return runNow(command);
    },
    edited() {
      if (waiting !== null) queueMicrotask(runWaiting);
    },
    dispose() {
      if (waiting !== null) clearTimeout(waiting.timer);
      waiting = null;
    },
  };
}
