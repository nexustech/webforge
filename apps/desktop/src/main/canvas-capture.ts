import type { BrowserWindow, Rectangle, WebContents } from "electron";
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
 * The element `selector` finds, as the window shows it, as a 480-pixel-wide JPEG: for the site's
 * picture in the Recent list (1.8, #1175). `undefined` without a window, with a crashed renderer,
 * without the element (never the whole window, editor and all), or for an empty image.
 */
export async function captureArea(
  window: CapturedWindow | undefined,
  selector: string,
): Promise<Uint8Array | undefined> {
  if (window === undefined || window.isDestroyed() || window.webContents.isCrashed()) {
    return undefined;
  }
  const area = await areaOf(window.webContents, selector);
  if (area === undefined) return undefined;
  const image = await window.webContents.capturePage(area);
  return image.isEmpty() ? undefined : image.resize({ width: 480 }).toJPEG(75);
}

/**
 * The editor's canvas as the window shows it, for a version's thumbnail in Version History (4.6):
 * see {@link captureArea}. The Recent list's picture is the home page's instead (`site-picture.ts`).
 */
export const captureCanvas = (window: CapturedWindow | undefined) =>
  captureArea(window, ".editor__canvas iframe");
