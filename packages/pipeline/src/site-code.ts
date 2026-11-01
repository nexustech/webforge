import { type BundledFile, isNodeDoc, type NodeDoc, type SiteSnapshot } from "@webforge/model";
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
 * `nodes` with each Custom Code element's code passed through `rewrite`, in slots too, as the
 * export draws them (3.9: the files kept with the site in place of their addresses).
 */
export function withCustomCode(
  nodes: readonly NodeDoc[],
  rewrite: (code: string) => string,
): NodeDoc[] {
  return nodes.map((node) => {
    const props: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node.props)) {
      props[key] = Array.isArray(value)
        ? value.map((item) =>
            isNodeDoc(item) ? (withCustomCode([item], rewrite)[0] ?? item) : item,
          )
        : value;
    }
    if (node.type === CUSTOM_CODE && typeof node.props.code === "string") {
      props.code = rewrite(node.props.code);
    }
    return { ...node, props: props as NodeDoc["props"] };
  });
}

/**
 * Which of the site's own code a build lets run (#649, S1 and S6), by its text: the Script, Head
 * and End of page of Settings' Custom Code, and each Custom Code element's code. CSS isn't code
 * that runs, and is always built.
 */
export type RunsCode = (code: string) => boolean;

/** Lets in all of the site's code: an export or a publish whose caller says nothing. */
export const RUNS_ALL_CODE: RunsCode = () => true;

/** Lets in none of it: a preview whose caller says nothing, as the editor runs none. */
export const RUNS_NO_CODE: RunsCode = () => false;

/**
 * `site` with only the code `runs` lets in: what it leaves out is blank, as if the person had
 * written none. Blank code is kept as it is, whatever `runs` says.
 */
export function withRunnableCode(site: SiteSnapshot, runs: RunsCode): SiteSnapshot {
  if (runs === RUNS_ALL_CODE) return site;
  const kept = (code: string) => (code.trim() === "" || runs(code) ? code : "");
  return {
    ...site,
    ...(site.code === undefined
      ? {}
      : {
          code: {
            ...site.code,
            js: kept(site.code.js),
            head: kept(site.code.head),
            bodyEnd: kept(site.code.bodyEnd),
          },
        }),
    layout: {
      ...site.layout,
      header: withCustomCode(site.layout.header, kept),
      footer: withCustomCode(site.layout.footer, kept),
    },
    pages: site.pages.map((page) => ({
      ...page,
      doc: { ...page.doc, content: withCustomCode(page.doc.content, kept) },
    })),
  };
}

/** `text` with the characters a regular expression gives a meaning to escaped. */
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The site's own code with each address it names that is kept with the site (Download and bundle,
 * 3.9) pointing at the copy in `assets/vendor/`, from a file `prefix` away from the site's root. An
 * address is taken whole only: not where it is the start of a longer one. One that starts `//`
 * is the same file as its `https://` form.
 */
export function toBundled(
  bundled: readonly BundledFile[],
  prefix: string,
): (code: string) => string {
  if (bundled.length === 0) return (code) => code;
  const copies = new Map<string, string>();
  for (const { url, file } of bundled) {
    const copy = `${prefix}assets/vendor/${file}`;
    copies.set(url, copy);
    if (url.startsWith("https:")) copies.set(url.slice("https:".length), copy);
  }
  const addresses = [...copies.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp);
  // Ends where an address in HTML, CSS or a script string does: a quote, a space, `)`, `<`, `>`.
  const pattern = new RegExp(`(?:${addresses.join("|")})(?=["'\`\\s)<>]|$)`, "g");
  return (code) => code.replace(pattern, (url) => copies.get(url) ?? url);
}

/** Each Custom Code element's HTML in `site`: the Header's, the Footer's, then each page's. */
export function customHtml(site: SiteSnapshot): string[] {
  const found = customCodeIn([...site.layout.header, ...site.layout.footer], []);
  for (const page of site.pages) customCodeIn(page.doc.content, found);
  return found;
}

/**
 * The words of the code the person wrote that can be classes (3.9): every word of each Custom Code
 * element's HTML and of the HTML for every page's `<head>` and `<body>`, and of `custom.js` only
 * the words in its strings, where `classList` and `className` take theirs. Its keywords and names
 * (`static`, `table`, `visible`) would make rules for nothing. Not `custom.css`, whose class names
 * are its own.
 */
export function siteCodeCandidates(site: SiteSnapshot): string[] {
  const { head = "", bodyEnd = "", js = "" } = site.code ?? {};
  return [
    ...[...customHtml(site), head, bodyEnd].flatMap(codeCandidates),
    ...scriptStrings(js).flatMap(codeCandidates),
  ];
}

/**
 * A string or template literal: its quote, then anything but that quote unless escaped. A `"…"` or
 * `'…'` string ends with its line, so an apostrophe in a comment or a regular expression is tried
 * to its line's end only, never to the end of a long script.
 */
const STRING_LITERAL = /"((?:\\.|[^"\\\n])*)"|'((?:\\.|[^'\\\n])*)'|`((?:\\[\s\S]|[^`\\])*)`/g;

/** The text of each string and template literal in `script`, as written. */
export function scriptStrings(script: string): string[] {
  return Array.from(
    script.matchAll(STRING_LITERAL),
    (match) => match[1] ?? match[2] ?? match[3] ?? "",
  );
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
