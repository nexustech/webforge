import { describe, expect, it } from "vitest";
import { shownTheme } from "./editor-theme.js";
import { DEFAULT_PREFERENCES, preferencesSchema } from "./ipc/prefs.js";

describe("the editor's appearance (#1169)", () => {
  it("follows the computer for a new install, and shows a choice of Dark or Light whatever it is", () => {
    expect(DEFAULT_PREFERENCES.theme).toBe("system");
    expect(shownTheme("system", true)).toBe("dark");
    expect(shownTheme("system", false)).toBe("light");
    expect(shownTheme("dark", false)).toBe("dark");
    expect(shownTheme("light", true)).toBe("light");
  });

  it("keeps the choice an install made before, as its preferences hold it", () => {
    expect(preferencesSchema.shape.theme.parse("dark")).toBe("dark");
    expect(preferencesSchema.shape.theme.parse("light")).toBe("light");
  });
});
