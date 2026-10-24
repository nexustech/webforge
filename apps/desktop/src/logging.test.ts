import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Standards §4 and R12: the app logs only through `main/log.ts` (the app's log file, codes only)
// and `renderer/log.ts` (which sends codes to it). A `console` call anywhere else could put a
// message, a path or site content where nothing checks it.

const SRC = import.meta.dirname;
const ALLOWED = new Set(["main/log.ts", "renderer/log.ts"]);

/** The app's source files, tests left out, as paths relative to `src/`. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test(?:-helper)?\.tsx?$/.test(entry.name)
      ? [relative(SRC, path).replaceAll("\\", "/")]
      : [];
  });
}

describe("logging (R12)", () => {
  it("goes through the log modules only: no console call anywhere else in the app", () => {
    const offenders = sourceFiles(SRC).filter(
      (file) =>
        !ALLOWED.has(file) &&
        // `console.error(…)` or `console["error"](…)`; not a property such as `transports.console`.
        /(?<![.\w])console\s*[.[]/.test(readFileSync(join(SRC, file), "utf8")),
    );

    expect(offenders).toEqual([]);
  });

  it("finds the app's sources, the log modules among them", () => {
    const files = sourceFiles(SRC);

    expect(files).toEqual(expect.arrayContaining([...ALLOWED, "main/index.ts"]));
  });
});
