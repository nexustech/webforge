import type { NativeImage } from "electron";
import { describe, expect, it, vi } from "vitest";
import { areaOf, type CapturedWindow, captureArea, captureCanvas } from "./canvas-capture.js";

/** A drawn page's pixels, four bytes each: white and the theme's colour. */
const DRAWN = new Uint8Array([255, 255, 255, 255, 30, 60, 90, 255]);
const WHITE = new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255]);
/** Refused at once, without taking it again. */
const AT_ONCE = { retries: 0, everyMs: 0 };

/**
 * A window whose page reports `area` for the element asked for, capturing an image `empty` or not,
 * whose pixels are `bitmap`'s (four bytes each).
 */
function fakeWindow(
  area: unknown,
  options: { crashed?: boolean; empty?: boolean; bitmap?: Uint8Array; later?: Uint8Array[] } = {},
) {
  const jpeg = new Uint8Array([0xff, 0xd8]);
  // Each capture's pixels: `bitmap`'s, then `later`'s in turn, the last kept; with `later`, each
  // JPEG after the first is the capture's number.
  const bitmaps = [options.bitmap ?? DRAWN, ...(options.later ?? [])];
  let taken = 0;
  const resize = vi.fn(() => {
    const bitmap = bitmaps[Math.min(taken, bitmaps.length - 1)];
    const number = taken++;
    return {
      toJPEG: vi.fn(() =>
        number === 0 || options.later === undefined ? jpeg : new Uint8Array([number]),
      ),
      toBitmap: () => bitmap,
    };
  });
  const image = { isEmpty: () => options.empty === true, resize } as unknown as NativeImage;
  const capturePage = vi.fn(async () => image);
  const executeJavaScript = vi.fn(async (_code: string) => area);
  const window: CapturedWindow = {
    isDestroyed: () => false,
    webContents: {
      isCrashed: () => options.crashed === true,
      executeJavaScript,
      capturePage,
    } as unknown as CapturedWindow["webContents"],
  };
  return { window, capturePage, resize, jpeg, executeJavaScript };
}

describe("areaOf", () => {
  it("rounds the element's place in the window, and gives nothing for anything else", async () => {
    const at = (area: unknown) =>
      areaOf({ executeJavaScript: async () => area } as never, "[data-x]");

    expect(await at({ x: 240.4, y: 48.6, width: 800.2, height: 600 })).toEqual({
      x: 240,
      y: 49,
      width: 800,
      height: 600,
    });
    expect(await at(null)).toBeUndefined();
    expect(await at({ x: 0, y: 0, width: 0, height: 10 })).toBeUndefined();
    expect(
      await areaOf(
        { executeJavaScript: async () => Promise.reject(new Error("gone")) } as never,
        "[data-x]",
      ),
    ).toBeUndefined();
  });

  it("finds the element by the selector, quoted as a string", async () => {
    const { window, executeJavaScript } = fakeWindow(null);
    await areaOf(window.webContents, '[data-site-picture="a\\"b"]');
    expect(executeJavaScript.mock.calls[0]?.[0]).toContain(
      `document.querySelector(${JSON.stringify('[data-site-picture="a\\"b"]')})`,
    );
  });
});

describe("captureArea", () => {
  it("captures the element's area, 480 pixels wide, as a JPEG", async () => {
    const { window, capturePage, resize, jpeg } = fakeWindow({ x: 1, y: 2, width: 3, height: 4 });

    expect(await captureArea(window, "[data-x]")).toBe(jpeg);
    expect(capturePage).toHaveBeenCalledWith({ x: 1, y: 2, width: 3, height: 4 });
    expect(resize).toHaveBeenCalledWith({ width: 480 });
  });

  it("never captures the whole window when the element isn't there (#1175)", async () => {
    const { window, capturePage } = fakeWindow(null);
    expect(await captureArea(window, "[data-x]")).toBeUndefined();
    expect(capturePage).not.toHaveBeenCalled();
  });

  it("captures nothing without a window, from a crashed renderer, or as an empty image", async () => {
    expect(await captureArea(undefined, "[data-x]")).toBeUndefined();
    const crashed = fakeWindow({ x: 1, y: 2, width: 3, height: 4 }, { crashed: true });
    expect(await captureArea(crashed.window, "[data-x]")).toBeUndefined();
    expect(crashed.capturePage).not.toHaveBeenCalled();
    const empty = fakeWindow({ x: 1, y: 2, width: 3, height: 4 }, { empty: true });
    expect(await captureArea(empty.window, "[data-x]")).toBeUndefined();
  });

  it("refuses an image in one colour only when asked to, as the site's picture does (#1300)", async () => {
    const area = { x: 1, y: 2, width: 3, height: 4 };
    // Two pixels apart only in blue, and one colour but for alpha.
    const blue = new Uint8Array([10, 20, 30, 255, 10, 20, 31, 255]);
    const alpha = new Uint8Array([10, 20, 30, 255, 10, 20, 30, 0]);
    const drawn = fakeWindow(area, { bitmap: blue });
    expect(await captureArea(drawn.window, "[data-x]", { refuseOneColour: AT_ONCE })).toBe(
      drawn.jpeg,
    );
    const blank = fakeWindow(area, { bitmap: alpha });
    expect(
      await captureArea(blank.window, "[data-x]", { refuseOneColour: AT_ONCE }),
    ).toBeUndefined();
    // A blank page's thumbnail in Version History is still one.
    expect(await captureArea(blank.window, "[data-x]")).toBe(blank.jpeg);
  });
});

describe("captureArea, a picture in one colour taken again (#1323)", () => {
  const area = { x: 1, y: 2, width: 3, height: 4 };

  it("takes it again until the window shows the drawing", async () => {
    const { window, capturePage } = fakeWindow(area, { bitmap: WHITE, later: [WHITE, DRAWN] });
    const picture = await captureArea(window, "[data-x]", {
      refuseOneColour: { retries: 5, everyMs: 0 },
    });
    expect(picture).toEqual(new Uint8Array([2]));
    expect(capturePage).toHaveBeenCalledTimes(3);
  });

  it("refuses it once the retries are used up", async () => {
    const { window, capturePage } = fakeWindow(area, { bitmap: WHITE });
    const picture = await captureArea(window, "[data-x]", {
      refuseOneColour: { retries: 2, everyMs: 0 },
    });
    expect(picture).toBeUndefined();
    expect(capturePage).toHaveBeenCalledTimes(3);
  });

  it("waits between pictures", async () => {
    vi.useFakeTimers();
    try {
      const { window, capturePage } = fakeWindow(area, { bitmap: WHITE, later: [DRAWN] });
      const picture = captureArea(window, "[data-x]", {
        refuseOneColour: { retries: 5, everyMs: 50 },
      });
      await vi.advanceTimersByTimeAsync(49);
      expect(capturePage).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(await picture).toEqual(new Uint8Array([1]));
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives nothing when the window goes while it waits", async () => {
    const { window, capturePage } = fakeWindow(area, { bitmap: WHITE });
    let destroyed = false;
    const going = { ...window, isDestroyed: () => destroyed };
    const picture = captureArea(going, "[data-x]", { refuseOneColour: { retries: 5, everyMs: 0 } });
    destroyed = true;
    expect(await picture).toBeUndefined();
    expect(capturePage).toHaveBeenCalledTimes(1);
  });
});

describe("captureCanvas", () => {
  it("captures the editor's canvas, for Version History", async () => {
    const { window, executeJavaScript, jpeg } = fakeWindow({ x: 1, y: 2, width: 3, height: 4 });
    expect(await captureCanvas(window)).toBe(jpeg);
    expect(executeJavaScript.mock.calls[0]?.[0]).toContain(
      JSON.stringify(".editor__canvas iframe"),
    );
  });
});
