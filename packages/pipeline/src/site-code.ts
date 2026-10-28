import { isNodeDoc, type NodeDoc, type SiteSnapshot } from "@webforge/model";
import { type MinifyOptions, type MinifyOutput, minify } from "terser";

/** The Custom Code element's type (2.11): HTML the person wrote, exported as it is. */
const CUSTOM_CODE = "CustomCode";

/** The code of each Custom Code element in `nodes` and the elements in their slots. */
function customCodeIn(nodes: readonly NodeDoc[], found: string[]): string[] {
  for (const node of nodes) {
    // Hidden in Layers: the export leaves it out, and everything in it.
    if (node.props.hidden === true) continue;
    if (node.type === CUSTOM_CODE && typeof node.props.code === "string") {
      found.push(node.props.code);
    }
    for (const value of Object.values(node.props)) {
      if (Array.isArray(value)) customCodeIn(value.filter(isNodeDoc), found);
    }
  }
  return found;
}

/**
 * Everything in `site` the person wrote as code, where class names can be (3.9): each Custom Code
 * element's HTML, the HTML for every page's `<head>` and `<body>`, and `custom.js`, which can add
 * classes to the page. Not `custom.css`, whose class names are its own.
 */
export function customCode(site: SiteSnapshot): string[] {
  const found = customCodeIn([...site.layout.header, ...site.layout.footer], []);
  for (const page of site.pages) customCodeIn(page.doc.content, found);
  const { head = "", bodyEnd = "", js = "" } = site.code ?? {};
  return [...found, head, bodyEnd, js].filter((code) => code.trim() !== "");
}

/** What can't be in a class name, so a word ends there: whitespace, quotes, `<`, `>`, `=`, `;`. */
const NOT_IN_A_CLASS = /[\s"'`<>=;]+/;

/**
 * The words of `code` that can be Tailwind classes (ADR 0005, 3.9): every run of characters
 * between whitespace, quotes and tag brackets, as Tailwind's own scanner reads a file. A class in a
 * `class='…'` attribute, an unquoted one, or one a script adds is found as well as one in
 * `class="…"`. Tailwind makes CSS for the words that are classes and ignores the rest, so a word of
 * text costs nothing unless it is one (`hidden`).
 */
export function codeCandidates(code: string): string[] {
  return code
    .split(NOT_IN_A_CLASS)
    .filter((word) => word !== "" && word.length <= 200 && !word.startsWith("/"));
}

/**
 * Where `custom.js` has a mistake that stops browsers running it, by its line, or nothing when it
 * reads as a classic script (3.9). It is exported as written either way: a browser reports the same
 * mistake. An `import` or `export` is one, as the script isn't a module (X1).
 */
export async function scriptMistake(script: string): Promise<number | undefined> {
  let ast: unknown;
  try {
    ({ ast } = (await minify(script, READ_ONLY)) as MinifyOutput & { readonly ast?: unknown });
  } catch (error) {
    const line = (error as { line?: unknown }).line;
    return typeof line === "number" ? line : 1;
  }
  // Terser reads `import` and `export` in a script too; a browser doesn't.
  const body = (ast as { body?: readonly TopLevel[] } | undefined)?.body ?? [];
  return body.find((statement) => MODULE_ONLY.has(statement.TYPE))?.start.line;
}

/**
 * Terser's options to read a classic script and give its syntax tree, unchanged. `format.ast` is
 * in Terser's documentation but not its types.
 */
const READ_ONLY = {
  compress: false,
  mangle: false,
  module: false,
  format: { ast: true, code: false },
} as MinifyOptions;

/** A top-level statement as Terser's syntax tree has it: its kind, and where it starts. */
type TopLevel = { readonly TYPE: string; readonly start: { readonly line: number } };

/** Statements only a module can have. */
const MODULE_ONLY = new Set(["Import", "Export"]);
