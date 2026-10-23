import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkFolders,
  findCompilerProblems,
  formatCompilerProblems,
  isCheckedFile,
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
});
