import { minify as minifyHtml } from "html-minifier-terser";
import { minify as minifyJs } from "terser";

/**
 * The exported files made as small as is safe, for *Minify output* (X4, off by default). Exports
 * are readable unless the person asks for this.
 */

/**
 * `html` without comments and with runs of whitespace collapsed to one space or line break (never
 * removed, so inline text keeps its spacing). What's in `script`, `style`, `pre` and `textarea` stays as it is:
 * Custom Code runs as written (F-ED-15).
 */
export async function minifiedHtml(html: string): Promise<string> {
  return minifyHtml(html, {
    collapseWhitespace: true,
    conservativeCollapse: true,
    // A run with a line break becomes the line break: no bigger than a space, and what a script's
    // last line or a comment there needs.
    preserveLineBreaks: true,
    removeComments: true,
    decodeEntities: false,
    minifyCSS: false,
    minifyJS: false,
  });
}

/** `script`, a classic script, compressed and with its local names shortened; its globals kept. */
export async function minifiedJs(script: string): Promise<string> {
  const result = await minifyJs(script, {
    compress: true,
    mangle: true,
    module: false,
    toplevel: false,
    // Licence notices (`/*!`, `@license`) stay.
    format: { comments: "some" },
  });
  return result.code ?? script;
}

/** After these, and before these, whitespace never matters. */
const NO_SPACE_AFTER = new Set(["{", "}", ";", ",", ">", "(", ":", " "]);
const NO_SPACE_BEFORE = new Set(["{", "}", ";", ",", ">", ")", "!"]);

/**
 * `css` without comments (but licence notices) or whitespace that changes nothing. A
 * whitespace-only minifier: Tailwind's output nests rules, which CSS optimisers that rewrite rules
 * don't all read. Whitespace before a `:` or `(` is kept (`.a :hover`, `and (min-width…)`). A custom
 * property's value is kept as written but for its ends, each run of whitespace in it one space
 * (`--font: "Inter", sans-serif`), and so is the space of an empty one (`--x: ;`).
 */
export function minifiedCss(css: string): string {
  let out = "";
  let at = 0;
  // In a custom property's value, and how deep in brackets there; how deep in a `var(…)`.
  let custom = false;
  let depth = 0;
  let inVar = 0;
  while (at < css.length) {
    const char = css.charAt(at);
    if (char === '"' || char === "'") {
      const end = stringEnd(css, at);
      out += css.slice(at, end);
      at = end;
    } else if (char === "/" && css.charAt(at + 1) === "*") {
      const end = css.indexOf("*/", at + 2);
      let after = end === -1 ? css.length : end + 2;
      // A `/*!` comment is a licence notice (Tailwind's, daisyUI's): it stays, the whitespace
      // after it doesn't.
      if (css.charAt(at + 2) === "!") {
        out += css.slice(at, after);
        while (/\s/.test(css.charAt(after))) after += 1;
      }
      at = after;
    } else if (/\s/.test(char)) {
      let next = at;
      while (next < css.length && /\s/.test(css.charAt(next))) next += 1;
      // After a licence notice, as after whitespace, none is needed.
      const before = out.endsWith("*/") ? " " : (out.at(-1) ?? "");
      const after = css.charAt(next);
      if (keepsSpace(before, after, custom, depth, inVar)) out += " ";
      at = next;
    } else {
      if (inVar > 0) {
        if (char === "(") inVar += 1;
        else if (char === ")") inVar -= 1;
      } else if (char === "(" && out.endsWith("var")) {
        // A fallback is kept as written, like a custom property's value.
        inVar = 1;
      }
      if (custom) {
        if (char === "(" || char === "[") depth += 1;
        else if (char === ")" || char === "]") depth -= 1;
        else if ((char === ";" || char === "}") && depth <= 0) custom = false;
      } else if (char === ":") {
        // A declaration whose name starts with `--`: what follows is a custom property's value.
        const start = Math.max(out.lastIndexOf("{"), out.lastIndexOf(";")) + 1;
        if (out.slice(start).trimStart().startsWith("--")) {
          custom = true;
          depth = 0;
        }
      }
      // The last declaration of a block needs no `;`.
      if (char === "}" && out.endsWith(";")) out = out.slice(0, -1);
      out += char;
      at += 1;
    }
  }
  return out;
}

/**
 * Whether a run of whitespace between `before` and `after` (the characters either side of it) must
 * stay, as one space. In a custom property's value or a `var(…)` it does but at the value's ends.
 */
function keepsSpace(
  before: string,
  after: string,
  custom: boolean,
  depth: number,
  inVar: number,
): boolean {
  // An empty custom property keeps its space: `--x: ;`.
  if (before === ":" && (after === ";" || after === "}")) return true;
  if (before === "" || before === " " || after === "") return false;
  if (inVar > 0 || (custom && depth > 0)) return true;
  if (custom) return before !== ":" && after !== ";" && after !== "}";
  return !NO_SPACE_AFTER.has(before) && !NO_SPACE_BEFORE.has(after);
}

/** Where the string starting at `start` (at its quote) ends, after its closing quote. */
function stringEnd(css: string, start: number): number {
  const quote = css.charAt(start);
  let at = start + 1;
  while (at < css.length) {
    const char = css.charAt(at);
    if (char === "\\") at += 2;
    else if (char === quote) return at + 1;
    else at += 1;
  }
  return css.length;
}
