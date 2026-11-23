import { DEFAULT_THEME } from "@webforge/model";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubFrames } from "../testing/frames.test-helper.js";
import {
  CHOSEN_PREVIEW_MS,
  endThemePreview,
  followThemeChange,
  previewTheme,
  themePreviewOf,
} from "./theme-preview.js";

/** A session as the preview keys it: by its history. */
const session = () => ({ history: {} });

/** The theme with its brand colour at hue `h`: a step of a drag. */
const hue = (h: number) => ({
  ...DEFAULT_THEME,
  colors: { ...DEFAULT_THEME.colors, primary: { l: 0.6, c: 0.2, h } },
});

let frames: ReturnType<typeof stubFrames>;

beforeEach(() => {
  vi.useFakeTimers();
  frames = stubFrames();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("a theme being chosen (5.30, OL-18)", () => {
  it("is one store per session, shown until it ends", () => {
    const one = session();
    const other = session();
    expect(themePreviewOf(one)).toBe(themePreviewOf(one));
    previewTheme(one, DEFAULT_THEME);
    frames.run();
    expect(themePreviewOf(one).getState().preview).toEqual({
      theme: DEFAULT_THEME,
      chosen: false,
    });
    expect(themePreviewOf(other).getState().preview).toBeUndefined();

    endThemePreview(one, false);
    expect(themePreviewOf(one).getState().preview).toBeUndefined();
  });

  it("keeps a chosen theme until the page shows it, or for a while at most", () => {
    const one = session();
    previewTheme(one, DEFAULT_THEME);
    frames.run();
    endThemePreview(one, true);
    expect(themePreviewOf(one).getState().preview).toEqual({ theme: DEFAULT_THEME, chosen: true });

    vi.advanceTimersByTime(CHOSEN_PREVIEW_MS);
    expect(themePreviewOf(one).getState().preview).toBeUndefined();
  });

  it("leaves a newer preview when an older chosen one's time is up", () => {
    const one = session();
    previewTheme(one, DEFAULT_THEME);
    endThemePreview(one, true);
    const next = { ...DEFAULT_THEME, preset: "dark" };
    previewTheme(one, next);
    frames.run();

    vi.advanceTimersByTime(CHOSEN_PREVIEW_MS);
    expect(themePreviewOf(one).getState().preview).toEqual({ theme: next, chosen: false });
  });
});

describe("a drag's previews, one a frame (#1316)", () => {
  it("shows the latest colour once a frame, however many moves it had", () => {
    const one = session();
    const shown = vi.fn();
    themePreviewOf(one).subscribe(shown);

    for (let h = 0; h < 5; h++) previewTheme(one, hue(h));
    expect(shown).not.toHaveBeenCalled();
    expect(frames.waiting()).toBe(1);
    frames.run();
    expect(shown).toHaveBeenCalledOnce();
    expect(themePreviewOf(one).getState().preview).toEqual({ theme: hue(4), chosen: false });

    // The next frame's moves, the next frame's one preview.
    previewTheme(one, hue(5));
    previewTheme(one, hue(6));
    frames.run();
    expect(shown).toHaveBeenCalledTimes(2);
    expect(themePreviewOf(one).getState().preview?.theme).toEqual(hue(6));
  });

  it("chooses the last colour moved to, even before its frame", () => {
    const one = session();
    previewTheme(one, hue(1));
    frames.run();
    previewTheme(one, hue(2));
    endThemePreview(one, true);
    expect(themePreviewOf(one).getState().preview).toEqual({ theme: hue(2), chosen: true });
    expect(frames.waiting()).toBe(0);
  });

  it("shows nothing more after Escape, not even the frame still to come", () => {
    const one = session();
    previewTheme(one, hue(1));
    endThemePreview(one, false);
    frames.run();
    expect(themePreviewOf(one).getState().preview).toBeUndefined();
  });

  it("keeps each session's own frame", () => {
    const one = session();
    const other = session();
    previewTheme(one, hue(1));
    previewTheme(other, hue(2));
    frames.run();
    expect(themePreviewOf(one).getState().preview?.theme).toEqual(hue(1));
    expect(themePreviewOf(other).getState().preview?.theme).toEqual(hue(2));
  });
});

describe("followThemeChange (#1316)", () => {
  /** A session whose colour `h` was just chosen: its change is being made. */
  const chosen = (h: number) => {
    const one = session();
    previewTheme(one, hue(h));
    endThemePreview(one, true);
    return one;
  };

  it("ends a chosen preview at once when its change doesn't happen", async () => {
    const one = chosen(1);
    expect(await followThemeChange(one, Promise.resolve(false))).toBe(false);
    expect(themePreviewOf(one).getState().preview).toBeUndefined();
  });

  it("ends it when the change fails, and still fails", async () => {
    const one = chosen(1);
    const failure = new Error("not asked");
    await expect(followThemeChange(one, Promise.reject(failure))).rejects.toBe(failure);
    expect(themePreviewOf(one).getState().preview).toBeUndefined();
  });

  it("leaves it to the page's CSS when the change happens", async () => {
    const one = chosen(1);
    expect(await followThemeChange(one, Promise.resolve(true))).toBe(true);
    expect(themePreviewOf(one).getState().preview).toEqual({ theme: hue(1), chosen: true });
  });

  it("leaves a colour still being dragged", async () => {
    const one = session();
    previewTheme(one, hue(1));
    frames.run();
    await followThemeChange(one, Promise.resolve(false));
    expect(themePreviewOf(one).getState().preview).toEqual({ theme: hue(1), chosen: false });
  });
});
