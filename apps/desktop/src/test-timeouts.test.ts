import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sourcesMatching } from "@webforge/test-utils/sources";
import { describe, expect, it } from "vitest";

// This package's tests already have a timeout scaled to the run's load (`vitest.config.ts`, ADR
// 0014). A test that sets its own replaces it, and a number stays the same however busy the run
// is: three dialogs' tests set the default itself, 15 s, and ran out of time in full runs (#1093).
// So a test's own timeout goes through `scaledTestTimeout`, which grows with the load as the
// default does.

/** The end of the string, comment or template that starts at `at`, which is one of them. */
function skip(source: string, at: number): number {
  const start = source[at];
  if (source.startsWith("//", at)) {
    const end = source.indexOf("\n", at);
    return end === -1 ? source.length : end;
  }
  if (source.startsWith("/*", at)) return source.indexOf("*/", at + 2) + 2;
  let index = at + 1;
  while (index < source.length && source[index] !== start) {
    index += source[index] === "\\" ? 2 : 1;
  }
  return index + 1;
}

/**
 * The call whose `(` is at `open`: the text of each top-level argument, and where it ends. It
 * goes from one bracket, comma, quote or comment to the next with a regular expression, not a
 * character at a time: the files are 2.6 MB, and coverage counts every step of a loop, which made
 * this test run out of time in full runs (#1147).
 */
function callAt(source: string, open: number): { readonly args: string[]; readonly end: number } {
  const tokens = /["'`([{)\]},]|\/\/|\/\*/g;
  const parts: string[] = [];
  let depth = 0;
  let from = open + 1;
  tokens.lastIndex = open;
  for (let token = tokens.exec(source); token !== null; token = tokens.exec(source)) {
    const index = token.index;
    const [char] = token;
    if (char.length === 2 || char === '"' || char === "'" || char === "`") {
      tokens.lastIndex = skip(source, index);
    } else if ("([{".includes(char)) {
      depth += 1;
    } else if (")]}".includes(char)) {
      depth -= 1;
      if (depth === 0) {
        parts.push(source.slice(from, index));
        const args = parts.map((part) => part.trim()).filter((part) => part !== "");
        return { args, end: index + 1 };
      }
    } else if (depth === 1) {
      // A comma between the call's own arguments.
      parts.push(source.slice(from, index));
      from = index + 1;
    }
  }
  return { args: parts, end: source.length };
}

/**
 * Each test's, group's or hook's own timeout in `source` given as a number, as `name: value`:
 * `it(name, fn, timeout)`, `it.skipIf(…)(name, fn, timeout)`, `it.each(…)(…)` and their
 * `test` and `describe` forms, and `beforeEach(fn, timeout)` and the other hooks.
 */
function unscaledTimeouts(source: string): string[] {
  const constants = new Set(
    [...source.matchAll(/^const ([A-Z][A-Z0-9_]*) = [\d_]+;/gm)].map(([, name = ""]) => name),
  );
  const unscaled = (timeout: string) => /^[\d_]+$/.test(timeout) || constants.has(timeout);
  const found: string[] = [];
  for (const call of source.matchAll(
    /\b(it|test|describe)((?:\.\w+)*)\(|\b(before|after)(Each|All)\(/g,
  )) {
    let { args, end } = callAt(source, call.index + call[0].length - 1);
    if (call[3] !== undefined) {
      // A hook: its function, and its timeout.
      if (unscaled(args[1] ?? "")) found.push(`${call[3]}${call[4]}: ${args[1]}`);
      continue;
    }
    // `it.skipIf(…)`, `it.each(…)` and the like return the test's function, called next.
    if (/\.(?:skipIf|runIf|each|for)$/.test(call[2] ?? "") && source[end] === "(") {
      ({ args, end } = callAt(source, end));
    }
    // A name, the test, and its timeout.
    if (unscaled(args[2] ?? "")) found.push(`${args[0]}: ${args[2]}`);
  }
  return found;
}

/**
 * Whether `source` has a call whose last argument is a number or a constant's name, which an
 * unscaled timeout is: a quick look that spares {@link unscaledTimeouts}' parse of the many test
 * files with none, which ran past the test's time limit in a loaded run (#1569).
 */
const mayHaveTimeout = (source: string) => /,\s*(?:[\d_]+|[A-Z][A-Z0-9_]*)\s*,?\s*\)/.test(source);

/**
 * A line that could hold such a call's last argument, for `git grep -E`, which reads one line at a
 * time: a number or a constant's name after a comma, or alone at the start of a line as Biome
 * writes a long call, then a comma, a bracket or the line's end.
 */
const TIMEOUT_LINE =
  "(,[[:space:]]*|^[[:space:]]*)([0-9][0-9_]*|[A-Z][A-Z0-9_]*)[[:space:]]*,?[[:space:]]*(\\)|$)";

describe("this package's test timeouts (ADR 0014, #1093)", () => {
  it("finds a test's, group's or hook's own timeout given as a number, written or named", () => {
    expect(
      unscaledTimeouts(`const SLOW = 15_000;
it("a (1)", async () => {
  setTimeout(() => {}, 100);
}, SLOW);
it("b", () => {}, 60_000);
test("c, d", () => {}, 2000);
it("e", () => {});
it("f", () => {}, scaledTestTimeout(15_000));
describe("g", () => {}, 30_000);
describe("h", () => {}, scaledTestTimeout(60_000));
it.skipIf(windows)("i", () => {}, 5_000);
it.each([1, 2])("j %i", () => {});
beforeAll(async () => {}, 30_000);
afterEach(() => {});`),
    ).toEqual([
      '"a (1)": SLOW',
      '"b": 60_000',
      '"c, d": 2000',
      '"g": 30_000',
      '"i": 5_000',
      "beforeAll: 30_000",
    ]);
  });

  it("parses only a file that has a call ending in a number or a constant", () => {
    const calls = [
      'it("b", () => {}, 60_000);',
      "}, SLOW);",
      "beforeAll(async () => {}, 30_000);",
      // As Biome writes a long call: one argument a line, and a comma after the last.
      'it(\n  "a long name",\n  async () => {},\n  60_000,\n);',
    ];
    for (const call of calls) expect(mayHaveTimeout(call), call).toBe(true);
    expect(mayHaveTimeout('it("e", () => {});\nsetTimeout(done, delay);')).toBe(false);

    // git's search, a line at a time, finds a file with each of them, and not one with none.
    const root = mkdtempSync(join(tmpdir(), "webforge-timeouts-"));
    try {
      execFileSync("git", ["init", "-q"], { cwd: root });
      for (const [at, call] of calls.entries()) {
        writeFileSync(join(root, `${at}.test.ts`), `${call}\n`);
      }
      writeFileSync(join(root, "none.test.ts"), 'it("e", () => {});\nexpect(x).toBe(3);\n');
      expect(sourcesMatching(root, TIMEOUT_LINE, ["*.test.ts"]).map((file) => file.path)).toEqual(
        calls.map((_, at) => `${at}.test.ts`),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("are always scaled to the run's load", () => {
    // Only the test files with a line that could end such a call, found by git in one search
    // (#1569), then parsed where a whole call could.
    const offending = sourcesMatching(import.meta.dirname, TIMEOUT_LINE, [
      "*.test.ts",
      "*.test.tsx",
    ])
      // Not this file, whose own example sets numbers.
      .filter((file) => !file.path.endsWith("test-timeouts.test.ts") && mayHaveTimeout(file.text))
      .flatMap((file) => unscaledTimeouts(file.text).map((each) => `${file.path} ${each}`));
    expect(offending).toEqual([]);
  });
});
