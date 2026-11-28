import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// A dialog's width (#1455): the dialog primitive sets `sm:max-w-md`, so a `max-w-*` without `sm:`
// on a dialog loses to it from 640 px and the dialog comes out narrower than its code asks.

const SRC = import.meta.dirname;
const ROOTS = [join(SRC, "renderer"), join(SRC, "../../../packages/editor-ui/src")];

/** Every `.tsx` under `dir`, its stories and tests left out. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx$/.test(entry.name) && !/\.(stories|test)\.tsx$/.test(entry.name) ? [path] : [];
  });
}

/** The `className` of each dialog panel opened in `source`, by its line. */
function dialogClassNames(source: string): { readonly line: number; readonly className: string }[] {
  const found: { line: number; className: string }[] = [];
  for (const match of source.matchAll(/<(?:Alert)?DialogContent\b([^>]*)>/g)) {
    const className = /className="([^"]*)"/.exec(match[1] ?? "")?.[1];
    if (className === undefined) continue;
    found.push({ line: source.slice(0, match.index).split("\n").length, className });
  }
  return found;
}

/** Whether `className` sets a dialog's width the primitive's `sm:max-w-md` overrides. */
const losesToPrimitive = (className: string) => /(^|\s)max-w-/.test(className);

describe("dialog widths (#1455)", () => {
  it("finds a width without sm: and lets one with it be", () => {
    expect(losesToPrimitive("max-w-lg")).toBe(true);
    expect(losesToPrimitive("h-auto min-h-48 max-w-sm")).toBe(true);
    expect(losesToPrimitive("sm:max-w-lg")).toBe(false);
    expect(losesToPrimitive("flex flex-col sm:max-w-5xl")).toBe(false);
    expect(
      dialogClassNames('<DialogContent\n  showClose={false}\n  className="max-w-lg">').map(
        (each) => each.className,
      ),
    ).toEqual(["max-w-lg"]);
  });

  it("no dialog asks for a width without sm:, which the primitive's would override", () => {
    const faults = ROOTS.flatMap((root) =>
      sources(root).flatMap((path) =>
        dialogClassNames(readFileSync(path, "utf8"))
          .filter((each) => losesToPrimitive(each.className))
          .map((each) => `${relative(root, path)}:${each.line} ${each.className}`),
      ),
    );
    expect(faults).toEqual([]);
  });
});
