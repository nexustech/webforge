import type { Debugger, WebContents } from "electron";
import { z } from "zod";
import type { AppElectron } from "./app-parts.js";
import { createSecureWebPreferences, hardenSession } from "./security.js";

/** What a page is saved as (5.22): a picture of all of it, or a PDF. */
export type CaptureKind = "png" | "pdf";

/** The window a page is drawn in, as much of Electron's `BrowserWindow` as is used. */
export type CaptureWindow = {
  readonly webContents: Pick<WebContents, "loadURL" | "printToPDF"> & {
    readonly debugger: Pick<Debugger, "attach" | "detach" | "sendCommand">;
  };
  destroy(): void;
  isDestroyed(): boolean;
};

/** A page drawn: its bytes, and whether a picture of it had to stop short of its end. */
type Capture = { readonly data: Uint8Array; readonly cut: boolean };

/** Draws the page at `url`, `width` CSS pixels wide, as `kind`. */
export type PageCapture = (url: string, width: number, kind: CaptureKind) => Promise<Capture>;

/** How tall the window is while the page loads: what's "in view" to it. */
export const WINDOW_HEIGHT = 900;

/** The tallest picture drawn, in CSS pixels: what Chromium draws in one go. */
export const MAX_IMAGE_HEIGHT = 16_384;

/** The tallest PDF page, in CSS pixels: a PDF page is at most 200 inches; a longer page runs on. */
const MAX_PDF_PAGE_HEIGHT = 200 * 96;

/** How long a page has to load and be drawn. */
const CAPTURE_MS = 60_000;

/**
 * Run in the page once it has loaded (its own scripts never run): every image loaded and decoded
 * (those below the fold are lazy, and wouldn't be), the fonts ready, then the page's height.
 */
const READY = `(async () => {
  const images = [...document.images];
  for (const image of images) image.loading = "eager";
  await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
  await document.fonts.ready;
  return Math.ceil(document.documentElement.scrollHeight);
})()`;

const evaluated = z.object({ result: z.object({ value: z.number().int().positive() }) });
const screenshot = z.object({ data: z.string().min(1) });

/**
 * Draws a page of Preview's own build (5.22, OL-9) in a window of its own: hidden, sandboxed, with
 * no preload and its own session (`createWindow`), as wide as the device the canvas shows. The
 * site's scripts never run in it, as they never run in any of Webforge's windows (only in the
 * person's browser): without them the site shows as it is, every entrance already in, the first of
 * each slideshow. A picture is of the whole page, as tall as it is (at most
 * {@link MAX_IMAGE_HEIGHT}); a PDF is the page as it prints, with its backgrounds, each page as
 * wide as the device. The window goes once it's drawn, or fails, or takes too long.
 */
export function createPageCapture(
  createWindow: (width: number, height: number) => CaptureWindow,
  timeoutMs = CAPTURE_MS,
): PageCapture {
  return async (url, width, kind) => {
    const window = createWindow(width, WINDOW_HEIGHT);
    const { webContents } = window;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const draw = async (): Promise<Capture> => {
      const send = (method: string, params?: object) =>
        webContents.debugger.sendCommand(method, params);
      // An empty page first: until a page has loaded, the debugger's commands never answer.
      await webContents.loadURL("about:blank");
      webContents.debugger.attach("1.3");
      // Before it loads: no script of the site's runs, nothing moves, and no scroll bar narrows it.
      await send("Emulation.setScriptExecutionDisabled", { value: true });
      await send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-motion", value: "reduce" }],
      });
      await send("Emulation.setDeviceMetricsOverride", {
        width,
        height: WINDOW_HEIGHT,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await send("Emulation.setScrollbarsHidden", { hidden: true });
      await webContents.loadURL(url);
      const height = evaluated.parse(
        await send("Runtime.evaluate", {
          expression: READY,
          awaitPromise: true,
          returnByValue: true,
        }),
      ).result.value;
      if (kind === "pdf") {
        const data = await webContents.printToPDF({
          printBackground: true,
          pageSize: { width: width / 96, height: Math.min(height, MAX_PDF_PAGE_HEIGHT) / 96 },
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        });
        return { data: new Uint8Array(data), cut: false };
      }
      const drawn = Math.min(height, MAX_IMAGE_HEIGHT);
      const { data } = screenshot.parse(
        await send("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: true,
          clip: { x: 0, y: 0, width, height: drawn, scale: 1 },
        }),
      );
      return { data: new Uint8Array(Buffer.from(data, "base64")), cut: drawn < height };
    };
    try {
      return await Promise.race([
        draw(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error("The page took too long to draw")), timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      if (!window.isDestroyed()) {
        try {
          webContents.debugger.detach();
        } catch {
          // Not attached, or already gone with the page.
        }
        window.destroy();
      }
    }
  };
}

/** The session pages are drawn in: in memory only, apart from the editor's. */
const CAPTURE_PARTITION = "webforge-capture";

/**
 * Whether a page drawn may load `url`: the preview's own server on this computer, and what a page
 * makes itself. Nothing from the internet: a script or picture a site's own code asks for there
 * isn't fetched for a picture of it.
 */
export function mayCaptureLoad(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return (
      protocol === "about:" ||
      protocol === "data:" ||
      protocol === "blob:" ||
      (protocol === "http:" && hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

/**
 * Windows to draw pages in (5.22): drawn off screen, never shown, focused or in the taskbar, sandboxed and isolated
 * with no preload, in a session of their own that grants no permission and loads nothing but the
 * preview's own server ({@link mayCaptureLoad}). Like every window, they can't open another or go
 * anywhere else (`hardenWebContents`, for every web contents).
 */
export function electronCaptureWindows(
  electron: Pick<AppElectron, "BrowserWindow" | "session">,
): (width: number, height: number) => CaptureWindow {
  let hardened = false;
  return (width, height) => {
    if (!hardened) {
      const capture = electron.session.fromPartition(CAPTURE_PARTITION);
      hardenSession(capture);
      capture.webRequest.onBeforeRequest((details, callback) => {
        callback({ cancel: !mayCaptureLoad(details.url) });
      });
      hardened = true;
    }
    return new electron.BrowserWindow({
      show: false,
      width,
      height,
      useContentSize: true,
      skipTaskbar: true,
      focusable: false,
      webPreferences: {
        ...createSecureWebPreferences(undefined),
        partition: CAPTURE_PARTITION,
        // Drawn off screen: a hidden window draws no frames to take a picture of.
        offscreen: true,
        backgroundThrottling: false,
      },
    });
  };
}
