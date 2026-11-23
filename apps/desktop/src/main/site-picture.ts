import type { IpcMain } from "electron";
import { appEvents } from "../shared/ipc/app.js";
import { type CapturedWindow, captureArea } from "./canvas-capture.js";
import { registerIpcHandler } from "./ipc.js";

/**
 * How long the renderer may take to draw the home page for its picture before it's given up on:
 * compiling the CSS a large home page needs, then up to 1.5 s for its fonts and pictures to load
 * (`SitePictureStage`), with room to spare on a slow computer.
 */
export const DRAW_TIMEOUT_MS = 4_000;

/** What the renderer draws the home page in for its picture (`SitePictureStage`). */
export const SITE_PICTURE_SELECTOR = "[data-site-picture]";

/** A window whose site's picture is taken; a fake in tests. */
export type PicturedWindow = CapturedWindow & {
  readonly webContents: CapturedWindow["webContents"] & {
    send(channel: string, ...args: unknown[]): void;
  };
};

/**
 * Pictures of sites for the start screen's Recent list (1.8, #1175): the home page as the export
 * draws it, never the editor. The renderer is asked to draw the home page (`app:site-picture`,
 * `draw`) and answers once it's drawn, or that it can't (`project:site-picture-drawn`); that is
 * captured, and the renderer takes the drawing away (`done`). A renderer that doesn't answer within
 * {@link DRAW_TIMEOUT_MS} gives no picture, nor does a capture in one colour, of nothing drawn
 * (#1300): the Recent list keeps the one it had.
 */
export function createSitePicture(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  options: { readonly drawTimeoutMs?: number } = {},
) {
  const timeoutMs = options.drawTimeoutMs ?? DRAW_TIMEOUT_MS;
  const waiting = new Map<number, (drawn: boolean) => void>();
  let nextId = 1;

  registerIpcHandler(ipc, "sitePictureDrawn", isTrustedSender, (id, drawn) => {
    waiting.get(id)?.(drawn);
    return null;
  });

  /** Asks the renderer to draw the home page; whether it did, in time. */
  const draw = (window: PicturedWindow, id: number): Promise<boolean> =>
    new Promise((resolve) => {
      const answer = (drawn: boolean) => {
        clearTimeout(timer);
        waiting.delete(id);
        resolve(drawn);
      };
      const timer = setTimeout(() => answer(false), timeoutMs);
      waiting.set(id, answer);
      window.webContents.send(appEvents.sitePicture.channel, id, "draw");
    });

  return {
    /** The open site's home page as a 480-pixel-wide JPEG, if the renderer draws it in time. */
    async capture(window: PicturedWindow | undefined): Promise<Uint8Array | undefined> {
      if (window === undefined || window.isDestroyed() || window.webContents.isCrashed()) {
        return undefined;
      }
      const id = nextId++;
      try {
        return (await draw(window, id))
          ? await captureArea(window, SITE_PICTURE_SELECTOR, { refuseOneColour: true })
          : undefined;
      } finally {
        if (!window.isDestroyed()) {
          window.webContents.send(appEvents.sitePicture.channel, id, "done");
        }
      }
    },
  };
}
