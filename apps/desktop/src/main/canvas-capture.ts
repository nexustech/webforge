import type { BrowserWindow, Rectangle, WebContents } from "electron";
import { z } from "zod";

const canvasAreaSchema = z.object({
  x: z.number().transform(Math.round),
  y: z.number().transform(Math.round),
  width: z.number().positive().transform(Math.round),
  height: z.number().positive().transform(Math.round),
});

/** Where the canvas is in the window, so the Recent thumbnail shows the page, not the panels. */
export async function canvasArea(
  contents: Pick<WebContents, "executeJavaScript">,
): Promise<Rectangle | undefined> {
  const area: unknown = await contents
    .executeJavaScript(
      `(() => { const r = document.querySelector(".editor__canvas iframe")?.getBoundingClientRect();
        return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null; })()`,
    )
    .catch(() => null);
  const parsed = canvasAreaSchema.safeParse(area);
  return parsed.success ? parsed.data : undefined;
}

/** The parts of a window capturing its canvas uses; a fake in tests. */
export type CapturedWindow = Pick<BrowserWindow, "isDestroyed"> & {
  readonly webContents: Pick<WebContents, "isCrashed" | "executeJavaScript" | "capturePage">;
};

/**
 * The window's canvas as a 480-pixel-wide JPEG, for the site's thumbnail in the Recent list (1.8);
 * `undefined` without a window, with a crashed renderer (no canvas to show), or for an empty image.
 */
export async function captureCanvas(
  window: CapturedWindow | undefined,
): Promise<Uint8Array | undefined> {
  if (window === undefined || window.isDestroyed() || window.webContents.isCrashed()) {
    return undefined;
  }
  const image = await window.webContents.capturePage(await canvasArea(window.webContents));
  return image.isEmpty() ? undefined : image.resize({ width: 480 }).toJPEG(75);
}
