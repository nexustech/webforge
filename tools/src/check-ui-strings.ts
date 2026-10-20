// UI-string guard: user-facing text in editor components must come from t() (CLAUDE.md, standards §4).
//
// Usage (see the root "ui-strings" script):
//   node tools/src/check-ui-strings.ts <folder>...
//
// Fails on JSX text and string literals in user-facing attributes (aria-label, title, placeholder…)
// in the .tsx files under the given folders. Tests and stories are skipped. TypeScript 7 has no
// JavaScript compiler API, so the files are parsed with swc, as dependency-cruiser does (ADR 0001).
//
// This file has no relative imports so Node can run it directly with type stripping.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parseSync } from "@swc/core";

/** JSX attributes whose value is shown to (or read out for) the user. */
export const USER_FACING_ATTRIBUTES: ReadonlySet<string> = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
  "label",
  "placeholder",
  "title",
]);

/** A hard-coded user-facing string. */
export type UiStringViolation = {
  readonly file: string;
  readonly line: number;
  /** `text` for JSX text, otherwise the attribute's name. */
  readonly where: string;
  readonly text: string;
};

type Span = { readonly start: number; readonly end: number };
type AstNode = { readonly type: string; readonly span?: Span; readonly [key: string]: unknown };

/** Text a person would read: anything with a letter in it. Punctuation and symbols alone are fine. */
const READABLE = /\p{L}/u;

function isNode(value: unknown): value is AstNode {
  return typeof value === "object" && value !== null && typeof (value as AstNode).type === "string";
}

/** The literal text of a string or expression-free template literal, else `null`. */
function literalText(node: unknown): string | null {
  if (!isNode(node)) {
    return null;
  }
  if (node.type === "StringLiteral") {
    return typeof node.value === "string" ? node.value : null;
  }
  if (node.type === "TemplateLiteral" && Array.isArray(node.expressions)) {
    const quasis = node.quasis;
    if (node.expressions.length === 0 && Array.isArray(quasis) && isNode(quasis[0])) {
      const cooked = quasis[0].cooked;
      return typeof cooked === "string" ? cooked : null;
    }
  }
  return null;
}

/** The literal text of a JSX attribute value (`"x"` or `{"x"}`), else `null`. */
function attributeText(value: unknown): string | null {
  if (isNode(value) && value.type === "JSXExpressionContainer") {
    return literalText(value.expression);
  }
  return literalText(value);
}

function attributeName(name: unknown): string | null {
  if (isNode(name) && name.type === "Identifier" && typeof name.value === "string") {
    return name.value;
  }
  return null;
}

function* walk(node: unknown): Generator<AstNode> {
  if (Array.isArray(node)) {
    for (const child of node) {
      yield* walk(child);
    }
    return;
  }
  if (!isNode(node)) {
    return;
  }
  yield node;
  for (const [key, child] of Object.entries(node)) {
    if (key !== "span" && typeof child === "object" && child !== null) {
      yield* walk(child);
    }
  }
}

/**
 * Finds hard-coded user-facing strings in one TSX source file. `file` is used for reporting only.
 */
export function findUiStrings(source: string, file: string): UiStringViolation[] {
  // swc reports UTF-8 byte offsets that keep counting across parses. A leading `;` gives the
  // module a first token at byte 0, so offsets can be made relative to the file.
  const ast = parseSync(`;${source}`, { syntax: "typescript", tsx: true });
  const base = ast.span.start + 1;
  const bytes = Buffer.from(source);
  const lineAt = (span: Span | undefined): number =>
    span === undefined
      ? 0
      : bytes
          .subarray(0, Math.max(0, span.start - base))
          .toString()
          .split("\n").length;

  const violations: UiStringViolation[] = [];
  const report = (node: AstNode, where: string, text: string) => {
    if (READABLE.test(text)) {
      violations.push({ file, line: lineAt(node.span), where, text: text.trim() });
    }
  };

  for (const node of walk(ast)) {
    if (node.type === "JSXText" && typeof node.value === "string") {
      report(node, "text", node.value);
    } else if (
      (node.type === "JSXElement" || node.type === "JSXFragment") &&
      Array.isArray(node.children)
    ) {
      // {"Literal"} as a child is JSX text in disguise.
      for (const child of node.children) {
        if (isNode(child) && child.type === "JSXExpressionContainer") {
          const text = literalText(child.expression);
          if (text !== null) report(child, "text", text);
        }
      }
    } else if (node.type === "JSXAttribute") {
      const name = attributeName(node.name);
      const text = attributeText(node.value);
      if (name !== null && text !== null && USER_FACING_ATTRIBUTES.has(name)) {
        report(node, name, text);
      }
    }
  }
  return violations.toSorted((a, b) => a.line - b.line);
}

/** Whether a file is checked: component sources, not their tests or stories. */
export function isCheckedFile(path: string): boolean {
  return path.endsWith(".tsx") && !/\.(test|stories)\.tsx$/.test(path);
}

/** Every checked file under `folder`, recursively, skipping `node_modules`. */
export function listCheckedFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && isCheckedFile(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => !path.split(/[\\/]/).includes("node_modules"))
    .toSorted();
}

/** Checks every file under `folders`. Paths in the result are relative to `root`. */
export function checkFolders(folders: readonly string[], root: string): UiStringViolation[] {
  return folders.flatMap((folder) =>
    listCheckedFiles(folder).flatMap((path) =>
      findUiStrings(readFileSync(path, "utf8"), relative(root, path).replaceAll("\\", "/")),
    ),
  );
}

/** One line per violation, for the terminal. */
export function formatUiStringViolations(violations: readonly UiStringViolation[]): string {
  const lines = violations.map(
    (violation) =>
      `  ${violation.file}:${violation.line}  ${violation.where}: ${JSON.stringify(violation.text)}`,
  );
  return [
    `Found ${violations.length} hard-coded UI string(s). Add a key to packages/i18n/src/en/ and use t():`,
    ...lines,
  ].join("\n");
}

function main(): void {
  const folders = process.argv.slice(2);
  if (folders.length === 0) {
    console.error("Usage: node tools/src/check-ui-strings.ts <folder>...");
    process.exitCode = 2;
    return;
  }
  const violations = checkFolders(folders, process.cwd());
  if (violations.length > 0) {
    console.error(formatUiStringViolations(violations));
    process.exitCode = 1;
    return;
  }
  console.log(`No hard-coded UI strings in ${folders.join(", ")}.`);
}

if (import.meta.main) {
  main();
}
