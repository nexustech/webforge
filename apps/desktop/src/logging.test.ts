import { describe, expect, it } from "vitest";
import { sourcesMatching } from "./main/source-files.js";

// Standards §4 and R12: the app logs only through `main/log.ts` (the app's log file, codes only)
// and `renderer/log.ts` (which sends codes to it). A `console` call anywhere else could put a
// message, a path or site content where nothing checks it.

const SRC = import.meta.dirname;
const ALLOWED = new Set(["main/log.ts", "renderer/log.ts"]);

/**
 * The app's source files that say `console` at all, tests and their helpers left out: found by git
 * in one search, so the scan stays quick in a loaded run (it timed out at 56 s once, as #1566 and
 * #1569 did), with their text.
 */
const mentioningConsole = () =>
  sourcesMatching(SRC, "console", ["*.ts", "*.tsx"], { fixed: true }).filter(
    (file) => !/\.test(?:-helper)?\.tsx?$/.test(file.path),
  );

describe("logging (R12)", () => {
  it("goes through the log modules only: no console call anywhere else in the app", () => {
    const offenders = mentioningConsole()
      .filter(
        (file) =>
          !ALLOWED.has(file.path) &&
          // `console.error(…)` or `console["error"](…)`; not a property such as `transports.console`.
          /(?<![.\w])console\s*[.[]/.test(file.text),
      )
      .map((file) => file.path);

    expect(offenders).toEqual([]);
  });

  it("finds the app's sources: the log modules, which call console, among them", () => {
    expect(mentioningConsole().map((file) => file.path)).toEqual(
      expect.arrayContaining([...ALLOWED]),
    );
  });
});
