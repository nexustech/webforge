import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMMAND_IDS } from "../shared/command-ids.js";
import { USAGE_COMMANDS, usageCommandOf } from "../shared/usage.js";

// The usage summary counts each command by a name from a fixed list (5.40, BD-1): a command the
// list doesn't have isn't counted. Every command the shell names, and every one the editor's code
// registers by a written id, must be on it, so a new one can't be missed.

const RENDERER = join(import.meta.dirname, "../renderer");

/** The renderer's source files, tests and stories left out. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.(test|stories)\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("the commands the usage summary counts (5.40)", () => {
  it("are listed once each", () => {
    expect(new Set(USAGE_COMMANDS).size).toBe(USAGE_COMMANDS.length);
  });

  it("have every command the shell names, and every one registered by a written id", () => {
    const written = sources(RENDERER).flatMap((path) =>
      [...readFileSync(path, "utf8").matchAll(/\bid: "([a-z]+\.[a-zA-Z.]+)"/g)].map(
        ([, id = ""]) => id,
      ),
    );

    expect(written.length).toBeGreaterThan(20);
    const ids = [...Object.values(COMMAND_IDS), ...written];
    expect(ids.filter((id) => usageCommandOf(id) === undefined)).toEqual([]);
  });

  it("count an id made from something else by its family's name only", () => {
    expect(usageCommandOf("page.goto.home000000000000")).toBe("page.goto");
    expect(usageCommandOf("add.item.Hero")).toBe("add.item");
    expect(usageCommandOf("help.page.getting-started")).toBe("help.page");
    expect(usageCommandOf("site.openRecent")).toBe("site.openRecent");
    expect(usageCommandOf("edit.undo")).toBe("edit.undo");
    expect(usageCommandOf("rosas.bakery")).toBeUndefined();
  });
});
