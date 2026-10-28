// UI-string guard: user-facing text in editor components must come from t() (CLAUDE.md, standards §4).
//
// Usage (see the root "ui-strings" script):
//   node tools/src/check-ui-strings.ts [--catalogue <folder>] <folder>...
//
// Fails on JSX text and on literal text in user-facing attributes and props (aria-label, title,
// placeholder, emptyText…), including inside `?:`, `&&`, `??` and template literals, in the .tsx
// files under the given folders. Tests and stories are skipped. With `--catalogue <folder>`, it
// also fails on a message of the string catalogue that spells out the app's name (`app.name`)
// rather than taking `{appName}` (#450). TypeScript 7 has no
// JavaScript compiler API, so the files are parsed with swc, as dependency-cruiser does (ADR 0001).
//
// This file has no relative imports so Node can run it directly with type stripping.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parseSync } from "@swc/core";

/**
 * Last words of attribute or prop names whose value is shown to (or read out for) people: `title`,
 * `aria-label`, `placeholder`, `alt`, and our own components' props such as `emptyText`,
 * `tooltip` or `ariaLabel`. `textAlign` ends in "align", so it is not one of them.
 */
export const USER_FACING_WORDS: ReadonlySet<string> = new Set([
  "alt",
  "caption",
  "description",
  "heading",
  "hint",
  "label",
  "message",
  "placeholder",
  "roledescription",
  "text",
  "title",
  "tooltip",
  "valuetext",
]);

/** Whether a JSX attribute or prop named `name` holds user-facing text. */
export function isUserFacingAttribute(name: string): boolean {
  if (name.startsWith("data-")) {
    return false;
  }
  const last = name.split(/[-_]|(?=[A-Z])/).at(-1) ?? name;
  return USER_FACING_WORDS.has(last.toLowerCase());
}

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

/**
 * The literal text an expression can put on screen: string literals, the fixed parts of template
 * literals, and both branches of `?:`, `&&`, `||` and `??`. Calls such as `t("key")` give none.
 */
function literalTexts(node: unknown): string[] {
  if (!isNode(node)) {
    return [];
  }
  switch (node.type) {
    case "StringLiteral":
      return typeof node.value === "string" ? [node.value] : [];
    case "TemplateLiteral": {
      const quasis = Array.isArray(node.quasis) ? node.quasis : [];
      const fixed = quasis
        .map((quasi: unknown) =>
          isNode(quasi) && typeof quasi.cooked === "string" ? quasi.cooked : "",
        )
        .join(" ");
      return [fixed];
    }
    case "ConditionalExpression":
      return [...literalTexts(node.consequent), ...literalTexts(node.alternate)];
    case "BinaryExpression":
      return node.operator === "&&" || node.operator === "||" || node.operator === "??"
        ? [...literalTexts(node.left), ...literalTexts(node.right)]
        : [];
    case "ParenthesisExpression":
    case "TsAsExpression":
    case "TsSatisfiesExpression":
    case "TsConstAssertion":
      return literalTexts(node.expression);
    default:
      return [];
  }
}

/** The literal texts of a JSX attribute value (`"x"` or `{expression}`). */
function attributeTexts(value: unknown): string[] {
  if (isNode(value) && value.type === "JSXExpressionContainer") {
    return literalTexts(value.expression);
  }
  return literalTexts(value);
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

/** `source` parsed, with the line each span starts on. */
function parsed(source: string, tsx: boolean) {
  // swc reports UTF-8 byte offsets that keep counting across parses. A leading `;` gives the
  // module a first token at byte 0, so offsets can be made relative to the file.
  const ast = parseSync(`;${source}`, { syntax: "typescript", tsx });
  const base = ast.span.start + 1;
  const bytes = Buffer.from(source);
  const lineAt = (span: Span | undefined): number =>
    span === undefined
      ? 0
      : bytes
          .subarray(0, Math.max(0, span.start - base))
          .toString()
          .split("\n").length;
  return { ast, lineAt };
}

/**
 * Finds hard-coded user-facing strings in one TSX source file. `file` is used for reporting only.
 */
export function findUiStrings(source: string, file: string): UiStringViolation[] {
  const { ast, lineAt } = parsed(source, true);
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
          for (const text of literalTexts(child.expression)) report(child, "text", text);
        }
      }
    } else if (node.type === "JSXAttribute") {
      const name = attributeName(node.name);
      if (name !== null && isUserFacingAttribute(name)) {
        for (const text of attributeTexts(node.value)) report(node, name, text);
      }
    }
  }
  return violations.toSorted((a, b) => a.line - b.line);
}

/** The catalogue's messages in one file of it: each property's key, text and line. */
function messagesIn(source: string): { key: string; text: string; line: number }[] {
  const { ast, lineAt } = parsed(source, false);
  return [...walk(ast)].flatMap((node) => {
    if (node.type !== "KeyValueProperty" || !isNode(node.key)) return [];
    const { key } = node;
    if (key.type !== "StringLiteral" || typeof key.value !== "string") return [];
    const name = key.value;
    return literalTexts(node.value).map((text) => ({ key: name, text, line: lineAt(key.span) }));
  });
}

/** The key of the one message that holds the app's name, which every other takes as `{appName}`. */
const APP_NAME_KEY = "app.name";

/**
 * Finds the messages in one file of the string catalogue that spell out the app's name, `name`,
 * rather than take `{appName}` (#450), so a rename stays a change to `app.name` alone. `file` is used
 * for reporting only.
 */
export function findAppNames(source: string, file: string, name: string): UiStringViolation[] {
  return messagesIn(source)
    .filter(({ key, text }) => key !== APP_NAME_KEY && text.includes(name))
    .map(({ key, text, line }) => ({ file, line, where: key, text }));
}

/**
 * Checks every file of the string catalogue under `folder` with {@link findAppNames}, the name read
 * from its `app.name`. Paths in the result are relative to `root`.
 */
export function checkCatalogue(folder: string, root: string): UiStringViolation[] {
  const files = readdirSync(folder, { withFileTypes: true, recursive: true })
    .filter(
      (entry) => entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts"),
    )
    .map((entry) => join(entry.parentPath, entry.name))
    .toSorted();
  const name = files
    .flatMap((path) => messagesIn(readFileSync(path, "utf8")))
    .find((message) => message.key === APP_NAME_KEY)?.text;
  if (name === undefined) {
    throw new Error(`No "${APP_NAME_KEY}" message in ${folder}`);
  }
  return files.flatMap((path) =>
    findAppNames(readFileSync(path, "utf8"), relative(root, path).replaceAll("\\", "/"), name),
  );
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

/** One line per message that spells out the app's name, for the terminal. */
export function formatAppNameViolations(violations: readonly UiStringViolation[]): string {
  const lines = violations.map(
    (violation) =>
      `  ${violation.file}:${violation.line}  ${violation.where}: ${JSON.stringify(violation.text)}`,
  );
  return [
    `Found ${violations.length} message(s) that spell out the app's name. Write {appName} instead, which t() fills in from app.name:`,
    ...lines,
  ].join("\n");
}

function main(): void {
  const args = process.argv.slice(2);
  const at = args.indexOf("--catalogue");
  const catalogue = at === -1 ? undefined : args[at + 1];
  const folders = args.filter((_, index) => at === -1 || (index !== at && index !== at + 1));
  if (folders.length === 0 || (at !== -1 && catalogue === undefined)) {
    console.error("Usage: node tools/src/check-ui-strings.ts [--catalogue <folder>] <folder>...");
    process.exitCode = 2;
    return;
  }
  const violations = checkFolders(folders, process.cwd());
  if (violations.length > 0) {
    console.error(formatUiStringViolations(violations));
    process.exitCode = 1;
    return;
  }
  const named = catalogue === undefined ? [] : checkCatalogue(catalogue, process.cwd());
  if (named.length > 0) {
    console.error(formatAppNameViolations(named));
    process.exitCode = 1;
    return;
  }
  console.log(`No hard-coded UI strings in ${folders.join(", ")}.`);
  if (catalogue !== undefined) {
    console.log(`No message in ${catalogue} spells out the app's name.`);
  }
}

if (import.meta.main) {
  main();
}
