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

/**
 * The classes each dialog panel opened in `source` asks for, by its line: every string in its
 * opening tag, so a `className={cn("…", …)}` counts as well as a `className="…"`. A `>` inside a
 * string, or an arrow function's `=>`, doesn't end the tag.
 */
function dialogClassNames(source: string): { readonly line: number; readonly className: string }[] {
  const found: { line: number; className: string }[] = [];
  for (const match of source.matchAll(/<(?:Alert)?DialogContent\b((?:"[^"]*"|=>|[^>"])*)>/g)) {
    const strings = [...(match[1] ?? "").matchAll(/"([^"]*)"/g)].map((each) => each[1] ?? "");
    if (strings.length === 0) continue;
    const line = source.slice(0, match.index).split("\n").length;
    found.push({ line, className: strings.join(" ") });
  }
  return found;
}

/**
 * Whether `className` asks for a dialog's width the primitive's `sm:max-w-md` overrides: a
 * `max-w-*` without `sm:`, and no `sm:max-w-*` beside it (`max-w-none sm:max-w-none` is fine).
 */
const losesToPrimitive = (className: string) =>
  /(^|\s)max-w-/.test(className) && !/(^|\s)sm:max-w-/.test(className);

describe("dialog widths (#1455)", () => {
  it("finds a width without sm: and lets one with it be", () => {
    expect(losesToPrimitive("max-w-lg")).toBe(true);
    expect(losesToPrimitive("h-auto min-h-48 max-w-sm")).toBe(true);
    expect(losesToPrimitive("sm:max-w-lg")).toBe(false);
    expect(losesToPrimitive("flex flex-col sm:max-w-5xl")).toBe(false);
    expect(losesToPrimitive("w-full max-w-none sm:max-w-none")).toBe(false);
  });

  it("reads a dialog's classes wherever its opening tag puts them", () => {
    const classes = (source: string) => dialogClassNames(source).map((each) => each.className);
    expect(classes('<DialogContent\n  showClose={false}\n  className="max-w-lg">')).toEqual([
      "max-w-lg",
    ]);
    expect(
      classes('<DialogContent onEscapeKeyDown={(event) => go(event)} className="max-w-lg">'),
    ).toEqual(["max-w-lg"]);
    expect(classes('<DialogContent className={cn("[&>p]:mt-1", "max-w-lg")}>')).toEqual([
      "[&>p]:mt-1 max-w-lg",
    ]);
    expect(classes("<DialogContent>")).toEqual([]);
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
