import { DEFAULT_THEME } from "@webforge/model";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHOSEN_PREVIEW_MS,
  endThemePreview,
  previewTheme,
  themePreviewOf,
} from "./theme-preview.js";

/** A session as the preview keys it: by its history. */
const session = () => ({ history: {} });

describe("a theme being chosen (5.30, OL-18)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("is one store per session, shown until it ends", () => {
    const one = session();
    const other = session();
    expect(themePreviewOf(one)).toBe(themePreviewOf(one));
    previewTheme(one, DEFAULT_THEME);
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

    vi.advanceTimersByTime(CHOSEN_PREVIEW_MS);
    expect(themePreviewOf(one).getState().preview).toEqual({ theme: next, chosen: false });
  });
});
