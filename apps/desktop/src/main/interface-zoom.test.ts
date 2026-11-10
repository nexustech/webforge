import { describe, expect, it, vi } from "vitest";
import { applyInterfaceZoom } from "./interface-zoom.js";
import { trafficLightPosition, zoomedMinimumSize } from "./window-options.js";

const fakeWindow = () => ({
  webContents: { setZoomFactor: vi.fn() },
  setMinimumSize: vi.fn(),
  setTitleBarOverlay: vi.fn(),
  setWindowButtonPosition: vi.fn(),
});

const screen = { width: 1920, height: 1080 };

describe("applyInterfaceZoom", () => {
  it("zooms the page and grows the native controls with its title bar on Windows", () => {
    const window = fakeWindow();

    applyInterfaceZoom(window, 1.25, { platform: "win32", theme: "dark", workArea: screen });

    expect(window.webContents.setZoomFactor).toHaveBeenCalledWith(1.25);
    expect(window.setMinimumSize).toHaveBeenCalledWith(1200, 750);
    expect(window.setTitleBarOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ height: 50, color: "#3b4248" }),
    );
    expect(window.setWindowButtonPosition).not.toHaveBeenCalled();
  });

  it("centres a Mac's traffic lights in the zoomed title bar", () => {
    const window = fakeWindow();

    applyInterfaceZoom(window, 0.8, { platform: "darwin", theme: "light", workArea: screen });

    expect(window.webContents.setZoomFactor).toHaveBeenCalledWith(0.8);
    expect(window.setWindowButtonPosition).toHaveBeenCalledWith({ x: 12, y: 8 });
    expect(window.setTitleBarOverlay).not.toHaveBeenCalled();
  });
});

describe("zoomedMinimumSize", () => {
  it("keeps 960 × 600 of the page's own pixels when zoomed in", () => {
    expect(zoomedMinimumSize(1, screen)).toEqual({ width: 960, height: 600 });
    expect(zoomedMinimumSize(1.5, screen)).toEqual({ width: 1440, height: 900 });
  });

  it("stays the smallest window when zoomed out", () => {
    expect(zoomedMinimumSize(0.8, screen)).toEqual({ width: 960, height: 600 });
  });

  it("is never bigger than the screen, nor smaller than the smallest window", () => {
    expect(zoomedMinimumSize(1.5, { width: 1366, height: 768 })).toEqual({
      width: 1366,
      height: 768,
    });
    expect(zoomedMinimumSize(1.5, { width: 0, height: 0 })).toEqual({ width: 960, height: 600 });
  });
});

describe("trafficLightPosition", () => {
  it("is where macOS puts them at 100%, and centred at other zooms", () => {
    expect(trafficLightPosition()).toEqual({ x: 12, y: 12 });
    expect(trafficLightPosition(1.5)).toEqual({ x: 12, y: 22 });
  });
});
