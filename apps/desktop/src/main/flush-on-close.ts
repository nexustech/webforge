import type { IpcMain } from "electron";
import { appEvents } from "../shared/ipc/app.js";
import { registerIpcHandler } from "./ipc.js";

/** How long a closing window waits for the renderer's last save before it closes anyway. */
const FLUSH_TIMEOUT_MS = 5_000;

/** The parts of a `BrowserWindow` the close flow uses; a fake in tests. */
export type ClosableWindow = {
  on(event: "close", listener: (event: { preventDefault(): void }) => void): void;
  close(): void;
  isDestroyed(): boolean;
  readonly webContents: { send(channel: string, ...args: unknown[]): void };
};

/**
 * Asks the renderer to save before its window closes (P2: "on close"): the first close is held
 * back, the renderer gets `app:flush` and answers `project:flushed` once its autosave has written
 * every change, and then the window closes for real. A renderer that doesn't answer within 5 s
 * (hung, crashed) doesn't keep the window open; the file then holds the last completed save.
 */
export function createFlushOnClose(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  options: { readonly timeoutMs?: number; readonly onClosed?: () => void } = {},
) {
  const timeoutMs = options.timeoutMs ?? FLUSH_TIMEOUT_MS;
  const waiting = new Map<number, () => void>();
  let nextId = 1;

  registerIpcHandler(ipc, "projectFlushed", isTrustedSender, (id) => {
    waiting.get(id)?.();
    return null;
  });

  /** Sends `app:flush` and resolves when the renderer answers or the timeout passes. */
  const requestFlush = (window: ClosableWindow): Promise<void> =>
    new Promise((resolve) => {
      const id = nextId++;
      const done = () => {
        clearTimeout(timer);
        waiting.delete(id);
        resolve();
      };
      const timer = setTimeout(done, timeoutMs);
      waiting.set(id, done);
      window.webContents.send(appEvents.flushRequest.channel, id);
    });

  return {
    requestFlush,
    /** Holds back the window's first close until its renderer has saved. */
    install(window: ClosableWindow): void {
      let flushed = false;
      window.on("close", (event) => {
        if (flushed) {
          return;
        }
        event.preventDefault();
        flushed = true;
        void requestFlush(window).then(() => {
          if (!window.isDestroyed()) {
            window.close();
          }
          options.onClosed?.();
        });
      });
    },
  };
}
