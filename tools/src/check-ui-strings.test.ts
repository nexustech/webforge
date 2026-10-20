import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkFolders,
  findUiStrings,
  formatUiStringViolations,
  isCheckedFile,
  isUserFacingAttribute,
} from "./check-ui-strings.js";

const FIXTURES = join(import.meta.dirname, "../test/fixtures/ui-strings");

describe("check-ui-strings", () => {
  it("passes a component whose text all comes from t()", () => {
    expect(checkFolders([join(FIXTURES, "pass")], FIXTURES)).toEqual([]);
  });

  it("reports JSX text and user-facing attributes, with their lines", () => {
    expect(checkFolders([join(FIXTURES, "fail")], FIXTURES)).toEqual([
      { file: "fail/Hardcoded.tsx", line: 7, where: "aria-label", text: "Pages" },
      { file: "fail/Hardcoded.tsx", line: 8, where: "text", text: "Pages" },
      { file: "fail/Hardcoded.tsx", line: 9, where: "placeholder", text: "Search pages" },
      { file: "fail/Hardcoded.tsx", line: 10, where: "title", text: "Add page" },
      { file: "fail/Hardcoded.tsx", line: 11, where: "text", text: "Add" },
      { file: "fail/Hardcoded.tsx", line: 13, where: "alt", text: "Café “logo”" },
      { file: "fail/Hardcoded.tsx", line: 14, where: "text", text: "Saving" },
      { file: "fail/Hardcoded.tsx", line: 15, where: "title", text: "pages" },
      { file: "fail/Hardcoded.tsx", line: 16, where: "emptyText", text: "No pages yet" },
    ]);
  });

  it("counts lines correctly after non-ASCII text", () => {
    const source = "const a = <p>{t('x')} “é”</p>;\nconst b = <p>Late</p>;\n";
    expect(findUiStrings(source, "x.tsx").map((v) => [v.line, v.text])).toEqual([
      [1, "“é”"],
      [2, "Late"],
    ]);
  });

  it("ignores attributes that are not shown to people, and text without letters", () => {
    const source = `const a = <div className="panel" data-state="open" id="x">· / — 42</div>;`;
    expect(findUiStrings(source, "x.tsx")).toEqual([]);
  });

  it("ignores template literals with expressions (they are built from t() values)", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the source under test has a template literal.
    const source = "const a = <div title={`${t('a')} ${t('b')}`} />;";
    expect(findUiStrings(source, "x.tsx")).toEqual([]);
  });

  it("finds literals inside ?:, && and ?? but not in calls", () => {
    const source = [
      'const a = <p>{open && "Close"}</p>;',
      'const b = <p aria-label={label ?? "Pages"} />;',
      'const c = <p>{busy ? t("saving") : t("saved")}</p>;',
      'const d = <p>{(open ? "Hide" : "Show") as string}</p>;',
    ].join("\n");
    expect(findUiStrings(source, "x.tsx").map((v) => [v.line, v.text])).toEqual([
      [1, "Close"],
      [2, "Pages"],
      [4, "Hide"],
      [4, "Show"],
    ]);
  });

  it("treats props that end in label, text, title… as user-facing", () => {
    for (const name of ["title", "aria-label", "ariaLabel", "emptyText", "tooltip", "alt"]) {
      expect(isUserFacingAttribute(name), name).toBe(true);
    }
    for (const name of ["className", "textAlign", "aria-labelledby", "data-title", "side", "id"]) {
      expect(isUserFacingAttribute(name), name).toBe(false);
    }
  });

  it("skips tests, stories and non-TSX files", () => {
    expect(isCheckedFile("Panel.tsx")).toBe(true);
    expect(isCheckedFile("Panel.test.tsx")).toBe(false);
    expect(isCheckedFile("Panel.stories.tsx")).toBe(false);
    expect(isCheckedFile("panel.ts")).toBe(false);
  });

  it("formats one line per violation", () => {
    const message = formatUiStringViolations([
      { file: "a/Panel.tsx", line: 3, where: "title", text: "Pages" },
    ]);
    expect(message).toContain("Found 1 hard-coded UI string(s)");
    expect(message).toContain('a/Panel.tsx:3  title: "Pages"');
  });
});
