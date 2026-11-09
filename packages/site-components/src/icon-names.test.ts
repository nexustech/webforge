import { describe, expect, it } from "vitest";
import OFFERED from "./icon-names-offered.json" with { type: "json" };
import { ICON_NAMES, iconNameOf } from "./icons.js";

// Every icon name Webforge has offered (#838): Lucide's names from lucide-static 1.59, when the
// Icon element came, to the version now. A site file may hold any of them. Lucide's icon list keeps
// no aliases, so an update that drops a name fails here until `RENAMED_ICONS` in icons.tsx maps it.
// After an update, add its new names (`ICON_NAMES`) to the list: it only grows.

/** The names among `names` that no longer draw an icon. */
const unresolved = (names: readonly string[]): string[] =>
  names.filter((name) => iconNameOf(name) === undefined);

describe("every icon name Webforge has offered (#838)", () => {
  it("still draws, by its own name or the one Lucide renamed it to", () => {
    expect(unresolved(OFFERED)).toEqual([]);
  });

  it("holds every name offered now, so the next update's checks start from them", () => {
    const offered = new Set(OFFERED);
    expect(ICON_NAMES.filter((name) => !offered.has(name))).toEqual([]);
  });

  it("holds 1.59's names that 1.70 renamed, and 1.70's new ones", () => {
    expect(OFFERED).toContain("triangle-alert");
    expect(OFFERED).toContain("triangle-exclamation-point");
    expect(new Set(OFFERED).size).toBe(OFFERED.length);
  });

  it("fails for a name Lucide dropped and no rename maps", () => {
    expect(unresolved([...OFFERED, "an-icon-lucide-dropped"])).toEqual(["an-icon-lucide-dropped"]);
  });
});
