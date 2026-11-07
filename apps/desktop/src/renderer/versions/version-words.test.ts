import { t } from "@webforge/i18n";
import { SITE_NAME_MAX } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { fit, newSiteName, versionName } from "./version-words.js";

describe("what Version History calls things (4.6)", () => {
  it("names a version by its name, or by why it was saved", () => {
    expect(versionName({ name: "Before the menu", reason: "manual" })).toBe("Before the menu");
    expect(versionName({ name: "", reason: "daily" })).toBe(t("versionHistory.reason.daily"));
    expect(versionName({ name: "", reason: "on-publish" })).toBe(
      t("versionHistory.reason.onPublish"),
    );
  });

  it("offers a new site's name that fits a site's, cutting the version's part short", () => {
    expect(newSiteName("Rosa's Bakery", "Before the menu")).toBe("Rosa's Bakery (Before the menu)");

    const long = newSiteName("Rosa's Bakery", "x".repeat(100));
    expect(long.length).toBe(SITE_NAME_MAX);
    expect(long).toMatch(/^Rosa's Bakery \(x+…\)$/);

    expect(newSiteName("s".repeat(100), "Before the menu")).toBe("s".repeat(100));
  });

  it("cuts text by the length the schemas count, never inside a character", () => {
    expect(fit("abc", 2)).toBe("ab");
    expect(fit("a😀b", 2)).toBe("a");
    expect(fit("a😀b", 3)).toBe("a😀");
  });
});
