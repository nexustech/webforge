import type { IpcMain } from "electron";
import { appEvents } from "../shared/ipc/app.js";
import { registerIpcHandler } from "./ipc.js";

/** How long a closing window waits for the renderer's last save before it closes anyway. */
const FLUSH_TIMEOUT_MS = 5_000;

/** A key press as Electron's `before-input-event` reports it. */
type KeyInput = {
  readonly type: string;
  readonly key: string;
  readonly control: boolean;
  readonly meta: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
};

/** The parts of a `BrowserWindow` the close flow uses; a fake in tests. */
export type ClosableWindow = {
  on(event: "close", listener: (event: { preventDefault(): void }) => void): void;
  close(): void;
  isDestroyed(): boolean;
  readonly webContents: {
    send(channel: string, ...args: unknown[]): void;
    on(
      event: "before-input-event",
      listener: (event: { preventDefault(): void }, input: KeyInput) => void,
    ): void;
  };
};

/** Ctrl+S (Cmd+S on macOS): "Save now" (P2). */
function isSaveShortcut(input: KeyInput): boolean {
  return (
    input.type === "keyDown" &&
    (input.control || input.meta) &&
    !input.alt &&
    !input.shift &&
    input.key.toLowerCase() === "s"
  );
}

/**
 * Asks the renderer to save before its window closes (P2: "on close"): the first close is held
 * back, the renderer gets `app:flush` and answers `project:flushed` once its autosave has written
 * every change, and then the window closes for real. A renderer that doesn't answer within 5 s
 * (hung, crashed) doesn't keep the window open; the file then holds the last completed save.
 *
 * Ctrl/Cmd+S uses the same request. The main process sees every key press in the window, including
 * those typed into the canvas iframe, which the renderer's own key handlers never get.
 */
export function createFlushOnClose(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  options: {
    readonly timeoutMs?: number;
    /** After the last save and before the window goes, e.g. to capture the Recent thumbnail. */
    readonly beforeClose?: (window: ClosableWindow) => Promise<void>;
    readonly onClosed?: () => void;
  } = {},
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
    /** Holds back the window's first close until its renderer has saved, and handles Ctrl/Cmd+S. */
    install(window: ClosableWindow): void {
      window.webContents.on("before-input-event", (event, input) => {
        if (isSaveShortcut(input)) {
          event.preventDefault();
          void requestFlush(window);
        }
      });
      let flushed = false;
      window.on("close", (event) => {
        if (flushed) {
          return;
        }
        event.preventDefault();
        flushed = true;
        void requestFlush(window)
          .then(() => options.beforeClose?.(window))
          .catch(() => undefined)
          .then(() => {
            if (!window.isDestroyed()) {
              window.close();
            }
            options.onClosed?.();
          });
      });
    },
  };
}
