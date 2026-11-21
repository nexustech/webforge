import type { NativeImage } from "electron";
import { describe, expect, it, vi } from "vitest";
import { areaOf, type CapturedWindow, captureArea, captureCanvas } from "./canvas-capture.js";

/** A window whose page reports `area` for the element asked for, capturing an image `empty` or not. */
function fakeWindow(area: unknown, options: { crashed?: boolean; empty?: boolean } = {}) {
  const jpeg = new Uint8Array([0xff, 0xd8]);
  const resize = vi.fn(() => ({ toJPEG: vi.fn(() => jpeg) }));
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

describe("captureCanvas", () => {
  it("captures the editor's canvas, for Version History", async () => {
    const { window, executeJavaScript, jpeg } = fakeWindow({ x: 1, y: 2, width: 3, height: 4 });
    expect(await captureCanvas(window)).toBe(jpeg);
    expect(executeJavaScript.mock.calls[0]?.[0]).toContain(
      JSON.stringify(".editor__canvas iframe"),
    );
  });
});
