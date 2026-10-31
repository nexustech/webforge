import { DEFAULT_THEME, type Theme } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { changeDraft, draftChange, draftChanges, draftLook, themeWithDraft } from "./look-draft.js";

const withLooks = (looks: Theme["looks"]): Theme => ({ ...DEFAULT_THEME, looks });

describe("a draft of a kind's look (4.10)", () => {
  it("keeps only the fields it changes, and is gone once it changes none", () => {
    const theme = withLooks({ Button: { lookCorners: "full" } });

    const draft = changeDraft(theme, undefined, "Button", "Button", { lookShadow: "large" });
    expect(draft?.change).toEqual({ lookShadow: "large" });
    expect(draftLook(theme, draft ?? { type: "", item: "", change: {} })).toEqual({
      lookCorners: "full",
      lookShadow: "large",
    });

    // Set back to what the look holds: nothing left to apply.
    expect(
      changeDraft(theme, draft, "Button", "Button", { lookShadow: undefined }),
    ).toBeUndefined();
    expect(draftChanges(theme, undefined)).toBe(false);
  });

  it("applies over the look as it is now, keeping a change made since it began (review)", () => {
    const before = withLooks({ Button: { lookCorners: "full", lookBorder: "thin" } });
    const draft = changeDraft(before, undefined, "Button", "Button", { lookShadow: "large" });
    if (draft === undefined) throw new Error("no draft");

    // Meanwhile Style this Button… or an AI app sets the Border, and an undo takes off the corners.
    const now = withLooks({ Button: { lookBorder: "thick" } });

    expect(draftChange(now, draft)).toEqual({ lookShadow: "large" });
    expect(themeWithDraft(now, draft).looks).toEqual({
      Button: { lookBorder: "thick", lookShadow: "large" },
    });
  });

  it("starts again for another kind, and takes a field off for undefined", () => {
    const theme = withLooks({ Button: { lookCorners: "full" }, Hero: { lookShadow: "small" } });
    const button = changeDraft(theme, undefined, "Button", "Button", { lookShadow: "large" });

    const hero = changeDraft(theme, button, "Hero", "Hero", { lookShadow: undefined });
    expect(hero).toEqual({ type: "Hero", item: "Hero", change: { lookShadow: undefined } });
    expect(themeWithDraft(theme, hero ?? { type: "", item: "", change: {} }).looks).toEqual({
      Button: { lookCorners: "full" },
    });
  });

  it("draws the theme with the draft, without a look once it is empty, the theme left as it was", () => {
    const theme = withLooks({ Button: { lookCorners: "full" } });

    expect(
      themeWithDraft(theme, { type: "Hero", item: "Hero", change: { lookShadow: "large" } }).looks,
    ).toEqual({ Button: { lookCorners: "full" }, Hero: { lookShadow: "large" } });
    expect(
      themeWithDraft(theme, { type: "Button", item: "Button", change: { lookCorners: undefined } }),
    ).not.toHaveProperty("looks");
    expect(theme.looks).toEqual({ Button: { lookCorners: "full" } });
  });
});
