import type { NativeImage } from "electron";
import { describe, expect, it, vi } from "vitest";
import {
  areaOf,
  type CapturedWindow,
  captureArea,
  captureCanvas,
  isOneColour,
} from "./canvas-capture.js";

/** Two pixels, as `toBitmap` gives them: white and black, or white twice. */
const TWO_COLOURS = Buffer.from([255, 255, 255, 255, 0, 0, 0, 255]);
const WHITE = Buffer.from([255, 255, 255, 255, 255, 255, 255, 255]);

/**
 * A window whose page reports `area` for the element asked for, capturing an image `empty` or not:
 * each capture's pixels the next of `bitmaps`, the last kept, and its JPEG the capture's number.
 */
function fakeWindow(
  area: unknown,
  options: { crashed?: boolean; empty?: boolean; bitmaps?: readonly Buffer[] } = {},
) {
  const bitmaps = options.bitmaps ?? [TWO_COLOURS];
  const jpeg = new Uint8Array([0xff, 0xd8]);
  let taken = 0;
  const resize = vi.fn(() => {
    const bitmap = bitmaps[Math.min(taken, bitmaps.length - 1)];
    const number = taken++;
    return {
      toBitmap: () => bitmap,
      toJPEG: vi.fn(() => (number === 0 ? jpeg : new Uint8Array([number]))),
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
});

describe("isOneColour", () => {
  it("says whether every pixel is the same colour, its alpha too", () => {
    expect(isOneColour({ toBitmap: () => WHITE })).toBe(true);
    expect(isOneColour({ toBitmap: () => TWO_COLOURS })).toBe(false);
    expect(isOneColour({ toBitmap: () => Buffer.from([1, 2, 3, 255, 1, 2, 3, 254]) })).toBe(false);
    expect(isOneColour({ toBitmap: () => Buffer.from([1, 2, 3, 4]) })).toBe(true);
  });
});

describe("captureArea while one colour (#1323)", () => {
  const area = { x: 1, y: 2, width: 3, height: 4 };

  it("takes a picture of one colour again until the window shows the drawing", async () => {
    const { window, capturePage } = fakeWindow(area, { bitmaps: [WHITE, WHITE, TWO_COLOURS] });
    const picture = await captureArea(window, "[data-x]", { retries: 5, everyMs: 0 });
    expect(picture).toEqual(new Uint8Array([2]));
    expect(capturePage).toHaveBeenCalledTimes(3);
  });

  it("keeps the last picture of one colour once the retries are used up", async () => {
    const { window, capturePage } = fakeWindow(area, { bitmaps: [WHITE] });
    const picture = await captureArea(window, "[data-x]", { retries: 2, everyMs: 0 });
    expect(picture).toEqual(new Uint8Array([2]));
    expect(capturePage).toHaveBeenCalledTimes(3);
  });

  it("waits between pictures", async () => {
    vi.useFakeTimers();
    try {
      const { window, capturePage } = fakeWindow(area, { bitmaps: [WHITE, TWO_COLOURS] });
      const picture = captureArea(window, "[data-x]", { retries: 5, everyMs: 50 });
      await vi.advanceTimersByTimeAsync(49);
      expect(capturePage).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(await picture).toEqual(new Uint8Array([1]));
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives nothing when the window goes while it waits", async () => {
    const { window, capturePage } = fakeWindow(area, { bitmaps: [WHITE] });
    let destroyed = false;
    const going = { ...window, isDestroyed: () => destroyed };
    const picture = captureArea(going, "[data-x]", { retries: 5, everyMs: 0 });
    destroyed = true;
    expect(await picture).toBeUndefined();
    expect(capturePage).toHaveBeenCalledTimes(1);
  });

  it("takes one picture without being asked to retry, one colour or not", async () => {
    const { window, capturePage, jpeg } = fakeWindow(area, { bitmaps: [WHITE] });
    expect(await captureArea(window, "[data-x]")).toBe(jpeg);
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
