import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TITLE_BAR_HEIGHT } from "../shared/title-bar.js";
import {
  mainWindowPlacement,
  titleBarOptions,
  titleBarOverlay,
  windowBackground,
} from "./window-options.js";

describe("titleBarOptions", () => {
  it.each(["win32", "linux"] as const)(
    "draws the native controls over the title bar on %s",
    (platform) => {
      expect(titleBarOptions(platform, "dark")).toEqual({
        titleBarStyle: "hidden",
        titleBarOverlay: { color: "#3b4248", symbolColor: "#ffffff", height: TITLE_BAR_HEIGHT },
      });
    },
  );

  it("centres the traffic lights in the title bar on macOS", () => {
    expect(titleBarOptions("darwin", "light")).toEqual({
      titleBarStyle: "hidden",
      titleBarOverlay: true,
      trafficLightPosition: { x: 12, y: 12 },
    });
  });
});

describe("titleBarOverlay", () => {
  it("uses each theme's title-bar and text colours", () => {
    expect(titleBarOverlay("light")).toEqual({
      color: "#d4d8de",
      symbolColor: "#26292b",
      height: 40,
    });
  });
});

describe("the native controls' colours", () => {
  const themeCss = readFileSync(
    fileURLToPath(import.meta.resolve("@webforge/editor-ui/theme.css")),
    "utf8",
  );
  const token = (theme: "dark" | "light", name: string) => {
    const start = themeCss.indexOf(`:root[data-theme="${theme}"] {`);
    const block = themeCss.slice(start, themeCss.indexOf("}", start));
    return new RegExp(`--${name}: (#[0-9a-f]{6});`).exec(block)?.[1];
  };

  it.each(["dark", "light"] as const)("match the %s theme's title bar", (theme) => {
    expect(titleBarOverlay(theme)).toMatchObject({
      color: token(theme, "titlebar"),
      symbolColor: token(theme, "foreground"),
    });
    expect(windowBackground(theme)).toBe(token(theme, "background"));
  });
});

describe("mainWindowPlacement (ADR 0008)", () => {
  const screen = { x: 0, y: 0, width: 1920, height: 1040 };
  const second = { x: 1920, y: 0, width: 1280, height: 1024 };

  it("opens maximised at first, 1280 × 800 when un-maximised", () => {
    expect(mainWindowPlacement(null, [screen])).toEqual({
      bounds: { width: 1280, height: 800 },
      maximized: true,
    });
  });

  it("opens as the person left it while that is on a screen", () => {
    const bounds = { x: 2000, y: 40, width: 1100, height: 700 };

    expect(mainWindowPlacement({ maximized: false, bounds }, [screen, second])).toEqual({
      bounds,
      maximized: false,
    });
  });

  it("centres a window left on a screen that is gone, and keeps the minimum size", () => {
    const bounds = { x: 2000, y: 40, width: 500, height: 300 };

    expect(mainWindowPlacement({ maximized: true, bounds }, [screen])).toEqual({
      bounds: { width: 960, height: 600 },
      maximized: true,
    });
  });

  it("keeps a window saved on a bigger screen within the screens there are now", () => {
    const bounds = { x: 0, y: 0, width: 3000, height: 1600 };

    expect(mainWindowPlacement({ maximized: false, bounds }, [screen]).bounds).toEqual({
      x: 0,
      y: 0,
      width: 1920,
      height: 1040,
    });
  });

  it("doesn't count a sliver at the edge of a screen as visible", () => {
    const bounds = { x: 1900, y: 100, width: 1000, height: 700 };

    expect(mainWindowPlacement({ maximized: false, bounds }, [screen]).bounds).toEqual({
      width: 1000,
      height: 700,
    });
  });
});
