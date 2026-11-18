import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

  it("are always scaled to the run's load", () => {
    const root = import.meta.dirname;
    const offending = readdirSync(root, { recursive: true, encoding: "utf8" })
      // Not this file, whose own example sets numbers.
      .filter((file) => /\.test\.tsx?$/.test(file) && !file.endsWith("test-timeouts.test.ts"))
      .flatMap((file) =>
        unscaledTimeouts(readFileSync(join(root, file), "utf8")).map((each) => `${file} ${each}`),
      );
    expect(offending).toEqual([]);
  });
});
