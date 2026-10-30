import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_THEME, themeIdSchema } from "@webforge/model";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const at = () => new Date("2026-10-27T09:30:00.000Z");

describe("My themes (2.23)", () => {
  it("keeps the person's own themes, most recently kept first, one per id", async () => {
    const themes = createMyThemes({ dir });
    expect(await themes.list()).toEqual([]);

    await themes.keep(own("theme0000000000a", "Bakery"));
    await themes.keep(own("theme0000000000b", "Shop"));
    await themes.keep({ ...own("theme0000000000a", "Bakery, warmer"), scheme: "dark" });

    expect((await themes.list()).map((theme) => [theme.own.name, theme.scheme])).toEqual([
      ["Bakery, warmer", "dark"],
      ["Shop", "light"],
    ]);
    // Another window, or the next run, reads the same.
    expect(await createMyThemes({ dir }).list()).toHaveLength(2);
  });

  it("writes one at a time, in the order asked, and says when it's done (before the app exits)", async () => {
    const themes = createMyThemes({ dir });
    for (const letter of ["a", "b", "c", "d"]) {
      void themes.keep(own(`theme000000000${letter}`, letter));
    }
    await themes.idle();
    expect((await createMyThemes({ dir }).list()).map((theme) => theme.own.name)).toEqual([
      "d",
      "c",
      "b",
      "a",
    ]);
  });

  it("removes one, and refuses a new one once it holds its most, keeping the rest", async () => {
    const themes = createMyThemes({ dir, max: 2 });
    expect(await themes.keep(own("theme0000000000a", "One"))).toBe("kept");
    expect(await themes.keep(own("theme0000000000b", "Two"))).toBe("kept");
    expect(await themes.keep(own("theme0000000000c", "Three"))).toBe("full");
    // One it holds can still change.
    expect(await themes.keep(own("theme0000000000a", "One, again"))).toBe("kept");
    expect((await themes.list()).map((theme) => theme.own.name)).toEqual(["One, again", "Two"]);

    await themes.remove("theme0000000000b");
    await themes.remove("theme0000000000z");
    expect((await themes.list()).map((theme) => theme.own.name)).toEqual(["One, again"]);
  });

  it("moves a file it can't read aside before writing, so no theme is lost", async () => {
    for (const unreadable of [
      "{ not json",
      JSON.stringify({ version: 2, themes: [{ from: "a newer version" }] }),
    ]) {
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir);
      writeFileSync(join(dir, "themes.json"), unreadable);
      const themes = createMyThemes({ dir, now: at });
      expect(await themes.list()).toEqual([]);

      await themes.keep(own("theme0000000000a", "Bakery"));

      expect((await themes.list()).map((theme) => theme.own.name)).toEqual(["Bakery"]);
      const aside = readdirSync(dir).filter((name) => name.startsWith("themes.damaged-"));
      expect(aside).toEqual(["themes.damaged-2026-10-27T09-30-00-000Z.json"]);
      expect(readFileSync(join(dir, aside[0] ?? ""), "utf8")).toBe(unreadable);
    }
  });

  it("gives a theme kept before the accent font its headings' font (3.22)", async () => {
    const theme = own("theme0000000000b", "Before 3.22");
    const { accent, ...fonts } = {
      ...theme.fonts,
      heading: { family: "Playfair Display", fallback: "serif" as const },
    };
    writeFileSync(
      join(dir, "themes.json"),
      JSON.stringify({ version: 1, themes: [{ ...theme, fonts }] }),
    );

    const [listed] = await createMyThemes({ dir }).list();
    expect(listed?.fonts).toEqual({ ...fonts, accent: fonts.heading });
    expect(listed?.own.name).toBe("Before 3.22");
  });

  it("skips a theme it can't read but keeps it", async () => {
    const newer = { own: { id: "theme0000000000n", name: "From a newer version" }, glow: 1 };
    writeFileSync(join(dir, "themes.json"), JSON.stringify({ version: 1, themes: [newer] }));
    const themes = createMyThemes({ dir });
    expect(await themes.list()).toEqual([]);

    await themes.keep(own("theme0000000000a", "Bakery"));
    const stored = JSON.parse(readFileSync(join(dir, "themes.json"), "utf8")) as {
      themes: unknown[];
    };
    expect(stored.themes).toHaveLength(2);
    expect(stored.themes[1]).toEqual(newer);
  });

  it("fails, writing nothing, when the file is there but locked, and renames past a brief lock", async () => {
    await createMyThemes({ dir }).keep(own("theme0000000000a", "Bakery"));
    const locked = Object.assign(new Error("busy"), { code: "EBUSY" });
    const readFile = vi.fn((_path: string, _encoding: "utf8") => Promise.reject<string>(locked));
    const busy = createMyThemes({ dir, files: { ...fs, readFile } });

    await expect(busy.list()).rejects.toThrow("busy");
    await expect(busy.keep(own("theme0000000000b", "Shop"))).rejects.toThrow("busy");
    await expect(busy.remove("theme0000000000a")).rejects.toThrow("busy");
    // The list is as it was: nothing was written over it.
    expect((await createMyThemes({ dir }).list()).map((theme) => theme.own.name)).toEqual([
      "Bakery",
    ]);

    // A rename that meets a lock once is tried again.
    const rename = vi
      .fn((from: string, to: string) => fs.rename(from, to))
      .mockRejectedValueOnce(Object.assign(new Error("locked"), { code: "EPERM" }));
    await createMyThemes({ dir, files: { ...fs, rename } }).keep(own("theme0000000000b", "Shop"));
    expect(rename).toHaveBeenCalledTimes(2);
    expect((await createMyThemes({ dir }).list()).map((theme) => theme.own.name)).toEqual([
      "Shop",
      "Bakery",
    ]);
  });
});
