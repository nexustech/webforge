import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// This package's tests already have a timeout scaled to the run's load (`vitest.config.ts`, ADR
// 0014). A test that sets its own replaces it, unscaled unless it uses `scaledTestTimeout`, so a
// timeout no longer than the default only ever shortens it under load: three dialogs' tests set
// the default itself, 15 s, and ran out of time in full runs (#1093).

/** The default's value on CI, before it is scaled. */
const DEFAULT_MS = 15_000;

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

/** The text of each top-level argument of the call whose `(` is at `open`. */
function argumentsAt(source: string, open: number): string[] {
  const parts: string[] = [];
  let depth = 0;
  let from = open + 1;
  let index = open;
  while (index < source.length) {
    const char = source[index] ?? "";
    if (char === '"' || char === "'" || char === "`" || source.startsWith("//", index)) {
      index = skip(source, index);
      continue;
    }
    if (source.startsWith("/*", index)) {
      index = skip(source, index);
      continue;
    }
    if ("([{".includes(char)) depth += 1;
    if (")]}".includes(char)) {
      depth -= 1;
      if (depth === 0) {
        parts.push(source.slice(from, index));
        return parts.map((part) => part.trim()).filter((part) => part !== "");
      }
    }
    if (char === "," && depth === 1) {
      parts.push(source.slice(from, index));
      from = index + 1;
    }
    index += 1;
  }
  return parts;
}

/** Each test's own timeout in `source` that is no longer than the default, as `name: value`. */
function shortTimeouts(source: string): string[] {
  const constants = new Map(
    [...source.matchAll(/^const ([A-Z][A-Z0-9_]*) = ([\d_]+);/gm)].map(
      ([, name = "", value = ""]) => [name, Number(value.replaceAll("_", ""))] as const,
    ),
  );
  const found: string[] = [];
  for (const call of source.matchAll(/\b(?:it|test)(?:\.(?:only|skip|fails|concurrent))?\(/g)) {
    const args = argumentsAt(source, call.index + call[0].length - 1);
    // A name, the test, and its timeout.
    if (args.length < 3) continue;
    const timeout = args[2] ?? "";
    const ms = /^[\d_]+$/.test(timeout)
      ? Number(timeout.replaceAll("_", ""))
      : constants.get(timeout);
    if (ms !== undefined && ms <= DEFAULT_MS) found.push(`${args[0]}: ${timeout}`);
  }
  return found;
}

describe("this package's test timeouts (ADR 0014, #1093)", () => {
  it("finds a test's own timeout no longer than the default, given or named", () => {
    expect(
      shortTimeouts(`const SLOW = 15_000;
it("a (1)", async () => {
  setTimeout(() => {}, 100);
}, SLOW);
it("b", () => {}, 60_000);
test("c, d", () => {}, 2000);
it("e", () => {});
it("f", () => {}, scaledTestTimeout(15_000));`),
    ).toEqual(['"a (1)": SLOW', '"c, d": 2000']);
  });

  it("are never set no longer than the default", () => {
    const root = import.meta.dirname;
    const offending = readdirSync(root, { recursive: true, encoding: "utf8" })
      // Not this file, whose own example sets short ones.
      .filter((file) => /\.test\.tsx?$/.test(file) && !file.endsWith("test-timeouts.test.ts"))
      .flatMap((file) =>
        shortTimeouts(readFileSync(join(root, file), "utf8")).map((each) => `${file} ${each}`),
      );
    expect(offending).toEqual([]);
  });
});
