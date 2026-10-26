import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_THEME, themeIdSchema } from "@webforge/model";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { OwnTheme } from "../shared/ipc/themes.js";
import { createMyThemes } from "./my-themes.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-my-themes-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** One of the person's own themes, `name`d, with id `id`. */
const own = (id: string, name: string): OwnTheme => ({
  ...structuredClone(DEFAULT_THEME),
  own: { id: themeIdSchema.parse(id), name },
});

describe("My themes (2.22)", () => {
  it("keeps the person's own themes, most recently kept first, one per id", () => {
    const themes = createMyThemes({ dir });
    expect(themes.list()).toEqual([]);

    themes.keep(own("theme0000000000a", "Bakery"));
    themes.keep(own("theme0000000000b", "Shop"));
    themes.keep({ ...own("theme0000000000a", "Bakery, warmer"), scheme: "dark" });

    expect(themes.list().map((theme) => [theme.own.name, theme.scheme])).toEqual([
      ["Bakery, warmer", "dark"],
      ["Shop", "light"],
    ]);
    // Another window, or the next run, reads the same.
    expect(createMyThemes({ dir }).list()).toHaveLength(2);
  });

  it("removes one, and keeps no more than its most", () => {
    const themes = createMyThemes({ dir, max: 2 });
    themes.keep(own("theme0000000000a", "One"));
    themes.keep(own("theme0000000000b", "Two"));
    themes.keep(own("theme0000000000c", "Three"));
    expect(themes.list().map((theme) => theme.own.name)).toEqual(["Three", "Two"]);

    themes.remove("theme0000000000b");
    themes.remove("theme0000000000z");
    expect(themes.list().map((theme) => theme.own.name)).toEqual(["Three"]);
  });

  it("reads a damaged file as none, and skips a theme it can't read but keeps it", () => {
    writeFileSync(join(dir, "themes.json"), "{ not json");
    expect(createMyThemes({ dir }).list()).toEqual([]);

    const newer = { own: { id: "theme0000000000n", name: "From a newer version" }, glow: 1 };
    writeFileSync(join(dir, "themes.json"), JSON.stringify({ version: 1, themes: [newer] }));
    const themes = createMyThemes({ dir });
    expect(themes.list()).toEqual([]);
    themes.keep(own("theme0000000000a", "Bakery"));
    const stored = JSON.parse(readFileSync(join(dir, "themes.json"), "utf8")) as {
      themes: unknown[];
    };
    expect(stored.themes).toHaveLength(2);
    expect(stored.themes[1]).toEqual(newer);
  });
});
