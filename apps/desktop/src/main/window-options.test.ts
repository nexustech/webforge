import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  TITLE_BAR_HEIGHT,
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
