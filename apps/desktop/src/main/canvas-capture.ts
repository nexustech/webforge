import type { BrowserWindow, NativeImage, Rectangle, WebContents } from "electron";
import { z } from "zod";

const areaSchema = z.object({
  x: z.number().transform(Math.round),
  y: z.number().transform(Math.round),
  width: z.number().positive().transform(Math.round),
  height: z.number().positive().transform(Math.round),
});

/** Where the element `selector` finds is in the window, if it is there and drawn. */
export async function areaOf(
  contents: Pick<WebContents, "executeJavaScript">,
  selector: string,
): Promise<Rectangle | undefined> {
  const area: unknown = await contents
    .executeJavaScript(
      `(() => { const r = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect();
        return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null; })()`,
    )
    .catch(() => null);
  const parsed = areaSchema.safeParse(area);
  return parsed.success ? parsed.data : undefined;
}

/** The parts of a window capturing a picture of it uses; a fake in tests. */
export type CapturedWindow = Pick<BrowserWindow, "isDestroyed"> & {
  readonly webContents: Pick<WebContents, "isCrashed" | "executeJavaScript" | "capturePage">;
};

/**
 * How many times a picture of one colour is taken again, and how long apart: a window can show a
 * drawing a little after the renderer has drawn it (#1323).
 */
export type WhileOneColour = { readonly retries: number; readonly everyMs: number };

/** Whether every pixel of `image` is the same colour: nothing on it, or not yet. */
export function isOneColour(image: Pick<NativeImage, "toBitmap">): boolean {
  const bitmap = image.toBitmap();
  for (let at = 4; at < bitmap.length; at += 4) {
    for (let channel = 0; channel < 4; channel++) {
      if (bitmap[at + channel] !== bitmap[channel]) return false;
    }
  }
  return true;
}

const live = (window: CapturedWindow) => !window.isDestroyed() && !window.webContents.isCrashed();

/** Resolves after `ms`. */
const after = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The element `selector` finds, as the window shows it, as a 480-pixel-wide JPEG: for the site's
 * picture in the Recent list (1.8, #1175). `undefined` without a window, with a crashed renderer,
 * without the element (never the whole window, editor and all), or for an empty image.
 *
 * With `whileOneColour`, a picture of one colour is taken again until it isn't, up to its
 * `retries`; the last is kept, for an element that is one colour.
 */
export async function captureArea(
  window: CapturedWindow | undefined,
  selector: string,
  whileOneColour?: WhileOneColour,
): Promise<Uint8Array | undefined> {
  if (window === undefined || !live(window)) return undefined;
  const area = await areaOf(window.webContents, selector);
  if (area === undefined) return undefined;
  const take = async () => {
    const image = await window.webContents.capturePage(area);
    return image.isEmpty() ? undefined : image.resize({ width: 480 });
  };
  const { retries, everyMs } = whileOneColour ?? { retries: 0, everyMs: 0 };
  let picture = await take();
  for (let retry = 0; retry < retries && picture !== undefined && isOneColour(picture); retry++) {
    await after(everyMs);
    if (!live(window)) return undefined;
    picture = await take();
  }
  return picture?.toJPEG(75);
}

/**
 * The editor's canvas as the window shows it, for a version's thumbnail in Version History (4.6):
 * see {@link captureArea}. The Recent list's picture is the home page's instead (`site-picture.ts`).
 */
export const captureCanvas = (window: CapturedWindow | undefined) =>
  captureArea(window, ".editor__canvas iframe");
