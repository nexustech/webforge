import { join } from "node:path";
import type { LoggerEvent } from "babel-plugin-react-compiler";
import { describe, expect, it, vi } from "vitest";
import {
  checkFolders,
  findCompilerProblems,
  formatCompilerProblems,
  isCheckedFile,
  problemOf,
  runCheck,
} from "./check-react-compiler.js";

const FIXTURES = join(import.meta.dirname, "../test/fixtures/react-compiler");

describe("check-react-compiler", () => {
  it("passes components and hooks the compiler compiles", () => {
    expect(checkFolders([join(FIXTURES, "pass")], FIXTURES)).toEqual([]);
  });

  it("reports what the compiler can't compile and where it is turned off, with their lines", () => {
    expect(
      checkFolders([join(FIXTURES, "fail")], FIXTURES).map(({ file, line, reason }) => [
        file,
        line,
        reason.split(".")[0],
      ]),
    ).toEqual([
      ["fail/Broken.tsx", 6, "Cannot access refs during render"],
      ["fail/Broken.tsx", 9, 'Turned off with a directive such as "use no memo"'],
    ]);
  });

  it("fails on a file it can't parse rather than passing it", () => {
    // Nor can the build: the check stops with Babel's error.
    expect(() => findCompilerProblems("export function Broken( {", "Broken.tsx")).toThrow();
  });

  it("turns the compiler's events into problems, and ignores the rest", () => {
    const at = (line: number) => ({ start: { line, column: 0 }, end: { line, column: 1 } });
    const events = [
      { kind: "CompileDiagnostic", fnLoc: at(4), detail: { reason: "A diagnostic" } },
      { kind: "PipelineError", fnLoc: at(5), data: "Internal error" },
      { kind: "CompileSkip", fnLoc: null, reason: "Not a component", loc: null },
      {
        kind: "CompileError",
        fnLoc: at(6),
        detail: { reason: "Bad", description: null, primaryLocation: () => null },
      },
      { kind: "CompileSuccess", fnLoc: at(7), fnName: "Panel" },
    ] as unknown as LoggerEvent[];

    expect(events.map((event) => problemOf("a.tsx", event))).toEqual([
      { file: "a.tsx", line: 4, reason: "A diagnostic" },
      { file: "a.tsx", line: 5, reason: "Compiler crashed: Internal error" },
      { file: "a.tsx", line: 0, reason: "Skipped: Not a component" },
      { file: "a.tsx", line: 6, reason: "Bad" },
      undefined,
    ]);
  });

  it("checks sources and stories, not tests or declarations", () => {
    expect(isCheckedFile("Panel.tsx")).toBe(true);
    expect(isCheckedFile("use-thing.ts")).toBe(true);
    expect(isCheckedFile("Panel.stories.tsx")).toBe(true);
    expect(isCheckedFile("Panel.test.tsx")).toBe(false);
    expect(isCheckedFile("thing.test.ts")).toBe(false);
    expect(isCheckedFile("env.d.ts")).toBe(false);
    expect(isCheckedFile("styles.css")).toBe(false);
  });

  it("formats one line per problem", () => {
    expect(
      formatCompilerProblems([{ file: "a/Panel.tsx", line: 3, reason: "Cannot access refs" }]),
    ).toBe(
      "The React Compiler reported 1 problem(s). Fix the code, don't opt out (ADR 0010):\n" +
        "  a/Panel.tsx:3  Cannot access refs",
    );
  });

  it("exits with 0 when everything compiles, 1 on a problem and 2 without folders", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(runCheck([join(FIXTURES, "pass")], FIXTURES)).toBe(0);
    expect(runCheck([join(FIXTURES, "fail")], FIXTURES)).toBe(1);
    expect(error.mock.calls.at(-1)?.[0]).toContain("fail/Broken.tsx:6");
    expect(runCheck([], FIXTURES)).toBe(2);

    log.mockRestore();
    error.mockRestore();
  });
});
