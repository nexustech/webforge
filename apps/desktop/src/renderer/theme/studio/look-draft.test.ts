import { DEFAULT_THEME, type Theme } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { changeDraft, draftChange, draftChanges, themeWithDraft } from "./look-draft.js";

const withLooks = (looks: Theme["looks"]): Theme => ({ ...DEFAULT_THEME, looks });

describe("a draft of a kind's look (4.10)", () => {
  it("starts from the theme's look, and is gone once it is the look again", () => {
    const theme = withLooks({ Button: { lookCorners: "full" } });

    const draft = changeDraft(theme, undefined, "Button", "Button", { lookShadow: "large" });
    expect(draft?.look).toEqual({ lookCorners: "full", lookShadow: "large" });
    expect(draftChange(theme, draft ?? { type: "", item: "", look: {} })).toEqual({
      lookShadow: "large",
    });

    expect(
      changeDraft(theme, draft, "Button", "Button", { lookShadow: undefined }),
    ).toBeUndefined();
    expect(draftChanges(theme, undefined)).toBe(false);
  });

  it("starts again for another kind, and takes a field off for undefined", () => {
    const theme = withLooks({ Button: { lookCorners: "full" }, Hero: { lookShadow: "small" } });
    const button = changeDraft(theme, undefined, "Button", "Button", { lookShadow: "large" });

    const hero = changeDraft(theme, button, "Hero", "Hero", { lookShadow: undefined });
    expect(hero).toEqual({ type: "Hero", item: "Hero", look: {} });
    expect(draftChange(theme, hero ?? { type: "", item: "", look: {} })).toEqual({
      lookShadow: undefined,
    });
  });

  it("draws the theme with the draft as its kind's look, without one when it is empty", () => {
    const theme = withLooks({ Button: { lookCorners: "full" } });

    expect(
      themeWithDraft(theme, { type: "Hero", item: "Hero", look: { lookShadow: "large" } }).looks,
    ).toEqual({ Button: { lookCorners: "full" }, Hero: { lookShadow: "large" } });
    expect(themeWithDraft(theme, { type: "Button", item: "Button", look: {} })).not.toHaveProperty(
      "looks",
    );
    // The theme itself is left as it was.
    expect(theme.looks).toEqual({ Button: { lookCorners: "full" } });
  });
});
