import type { NativeImage } from "electron";
import { describe, expect, it, vi } from "vitest";
import { type CapturedWindow, canvasArea, captureCanvas } from "./canvas-capture.js";

/** A window whose page reports `area` for the canvas, capturing an image `empty` or not. */
function fakeWindow(area: unknown, options: { crashed?: boolean; empty?: boolean } = {}) {
  const jpeg = new Uint8Array([0xff, 0xd8]);
  const resize = vi.fn(() => ({ toJPEG: vi.fn(() => jpeg) }));
  const image = { isEmpty: () => options.empty === true, resize } as unknown as NativeImage;
  const capturePage = vi.fn(async () => image);
  const window: CapturedWindow = {
    isDestroyed: () => false,
    webContents: {
      isCrashed: () => options.crashed === true,
      executeJavaScript: vi.fn(async () => area),
      capturePage,
    } as unknown as CapturedWindow["webContents"],
  };
  return { window, capturePage, resize, jpeg };
}

describe("canvasArea", () => {
  it("rounds the canvas's place in the window, and gives nothing for anything else", async () => {
    const at = (area: unknown) => canvasArea({ executeJavaScript: async () => area } as never);

    expect(await at({ x: 240.4, y: 48.6, width: 800.2, height: 600 })).toEqual({
      x: 240,
      y: 49,
      width: 800,
      height: 600,
    });
    expect(await at(null)).toBeUndefined();
    expect(await at({ x: 0, y: 0, width: 0, height: 10 })).toBeUndefined();
    expect(
      await canvasArea({
        executeJavaScript: async () => Promise.reject(new Error("gone")),
      } as never),
    ).toBeUndefined();
  });
});

describe("captureCanvas", () => {
  it("captures the canvas's area, 480 pixels wide, as a JPEG", async () => {
    const { window, capturePage, resize, jpeg } = fakeWindow({ x: 1, y: 2, width: 3, height: 4 });

    expect(await captureCanvas(window)).toBe(jpeg);
    expect(capturePage).toHaveBeenCalledWith({ x: 1, y: 2, width: 3, height: 4 });
    expect(resize).toHaveBeenCalledWith({ width: 480 });
  });

  it("captures nothing without a window, from a crashed renderer, or as an empty image", async () => {
    expect(await captureCanvas(undefined)).toBeUndefined();
    const crashed = fakeWindow(null, { crashed: true });
    expect(await captureCanvas(crashed.window)).toBeUndefined();
    expect(crashed.capturePage).not.toHaveBeenCalled();
    expect(await captureCanvas(fakeWindow(null, { empty: true }).window)).toBeUndefined();
  });
});
