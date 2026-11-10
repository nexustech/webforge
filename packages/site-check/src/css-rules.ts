/**
 * Reading the site's own `custom.css` for its rules (CT-8, 6.8): where each rule's selectors are,
 * and which of them nothing on the site can match. A scanner, not a parser: enough for rules at the
 * top level and inside `@media`, `@supports`, `@container` and `@layer`, which is where a stylesheet
 * puts them. What it can't read (keyframes, `@font-face`, nested rules) it passes over.
 */

/** A style rule: its selectors, and where its selector list is in the CSS. */
export type CssRule = {
  /** The selector list as written, trimmed. */
  readonly selector: string;
  /** Each selector of the list, trimmed. */
  readonly selectors: readonly string[];
  /** Where the selector list starts and ends in the CSS (`end` exclusive). */
  readonly from: number;
  readonly to: number;
};

/** The class names and ids the site's pages have, as the export writes them. */
export type UsedSelectors = {
  readonly classes: ReadonlySet<string>;
  readonly ids: ReadonlySet<string>;
};

/** At-rules whose block holds style rules: everything else's (`@font-face`, `@keyframes`) doesn't. */
const GROUPING = /^@(?:media|supports|container|layer|scope|document)\b/i;

/** The style rules in `css`, in order: at the top level and inside grouping at-rules. */
export function cssRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  /** Each open block: whether style rules can be in it. */
  const blocks: boolean[] = [];
  let start = 0;
  let index = 0;
  while (index < css.length) {
    const char = css[index];
    if (char === "/" && css[index + 1] === "*") {
      const end = css.indexOf("*/", index + 2);
      index = end === -1 ? css.length : end + 2;
      continue;
    }
    if (char === '"' || char === "'") {
      index = stringEnd(css, index);
      continue;
    }
    if (char === "{") {
      const raw = css.slice(start, index);
      const prelude = withoutComments(raw).trim();
      const holdsRules = blocks.every(Boolean);
      if (prelude.startsWith("@")) {
        blocks.push(holdsRules && GROUPING.test(prelude));
      } else {
        if (holdsRules && prelude !== "") {
          const from = start + (raw.length - raw.trimStart().length);
          const to = start + raw.trimEnd().length;
          rules.push({ selector: prelude, selectors: splitSelectors(prelude), from, to });
        }
        // A rule's own block holds declarations; rules nested in it aren't read.
        blocks.push(false);
      }
      start = index + 1;
    } else if (char === "}") {
      blocks.pop();
      start = index + 1;
    } else if (char === ";") {
      start = index + 1;
    }
    index += 1;
  }
  return rules;
}

/** The index just after the string that starts at `start`. */
function stringEnd(css: string, start: number): number {
  const quote = css[start];
  let index = start + 1;
  while (index < css.length && css[index] !== quote && css[index] !== "\n") {
    index += css[index] === "\\" ? 2 : 1;
  }
  return index + 1;
}

const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, " ");

/** The selectors of a selector list: split at its commas, not those in brackets or strings. */
function splitSelectors(list: string): string[] {
  const selectors: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < list.length; index++) {
    const char = list[index];
    if (char === '"' || char === "'") index = stringEnd(list, index) - 1;
    else if (char === "(" || char === "[") depth += 1;
    else if (char === ")" || char === "]") depth -= 1;
    else if (char === "," && depth === 0) {
      selectors.push(list.slice(start, index).trim());
      start = index + 1;
    }
  }
  selectors.push(list.slice(start).trim());
  return selectors.filter((selector) => selector !== "");
}

/**
 * The classes and ids an element must have for `selector` to match it. What's inside `:not()`,
 * `:is()`, `:where()`, `:has()` and attribute selectors is left out, as the selector can match
 * without them.
 */
export function selectorNeeds(selector: string): { classes: string[]; ids: string[] } {
  let plain = selector.replace(/\[(?:[^\]"']|"[^"]*"|'[^']*')*\]/g, " ");
  // Innermost brackets first, until none are left.
  for (let before = ""; before !== plain; ) {
    before = plain;
    plain = plain.replace(/:{1,2}[\w-]+\([^()]*\)/g, " ");
  }
  const classes: string[] = [];
  const ids: string[] = [];
  for (const match of plain.matchAll(/([.#])((?:\\[\s\S]|[\w -￿-])+)/g)) {
    const name = (match[2] ?? "").replace(/\\([\s\S])/g, "$1");
    // A number in a selector (`50%` in a keyframe, `.5` in nothing valid) isn't a class.
    if (/^-?\d/.test(name)) continue;
    (match[1] === "." ? classes : ids).push(name);
  }
  return { classes, ids };
}

/** Whether nothing with the classes and ids in `used` can match `selector`. */
export function matchesNothing(selector: string, used: UsedSelectors): boolean {
  const { classes, ids } = selectorNeeds(selector);
  return classes.some((name) => !used.classes.has(name)) || ids.some((id) => !used.ids.has(id));
}

/** The rules of `css` none of whose selectors can match anything on the site. */
export function unusedCssRules(css: string, used: UsedSelectors): CssRule[] {
  return cssRules(css).filter((rule) =>
    rule.selectors.every((selector) => matchesNothing(selector, used)),
  );
}
