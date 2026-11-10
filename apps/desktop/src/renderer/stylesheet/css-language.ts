import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import type { Diagnostic } from "@codemirror/lint";
import type { Tree } from "@lezer/common";
import { t } from "@webforge/i18n";
import type { SiteDoc, Theme } from "@webforge/model";
import {
  cssResources,
  isAllowed,
  type UsedSelectors,
  unusedCssRules,
  withCodeWords,
} from "@webforge/site-check";
import { themeCss } from "@webforge/themes";

/**
 * What the stylesheet editor knows of the site (CT-8, 6.8): the theme's CSS variables, the classes
 * and anchors the site has, and every class its styles support (2.18's catalogue).
 */
export type CssSiteData = {
  /** The theme's variables, `--color-primary`, without duplicates. */
  readonly variables: readonly string[];
  /** The classes the site's pages have, first, then the catalogue's. */
  readonly classes: readonly string[];
  /** The anchors of the site's sections, as ids. */
  readonly ids: readonly string[];
};

/** Each theme's variables, worked out once. */
const variablesOfTheme = new WeakMap<Theme, readonly string[]>();

/** The CSS variables `theme` defines, in the order its CSS defines them. */
export function themeVariables(theme: Theme): readonly string[] {
  const kept = variablesOfTheme.get(theme);
  if (kept !== undefined) return kept;
  const variables = [...new Set(themeCss(theme).match(/--[\w-]+(?=\s*:)/g))];
  variablesOfTheme.set(theme, variables);
  return variables;
}

/** The variables `css` defines itself (`--brand: …`), which it may use as the theme's. */
const ownVariables = (css: string) => new Set(css.match(/--[\w-]+(?=\s*:)/g));

/** Whether the position the tree resolves `pos` to is inside a block of declarations. */
function inDeclarations(tree: Tree, pos: number): boolean {
  for (let node: ReturnType<Tree["resolveInner"]> | null = tree.resolveInner(pos, -1); node; ) {
    if (node.name === "Block") return true;
    node = node.parent;
  }
  return false;
}

/**
 * Completion for the stylesheet: the theme's variables inside `var(`, and in a selector the site's
 * classes after `.` and its anchors after `#`. CSS's own properties and values come from the
 * language, beside these.
 */
export function cssSiteCompletion(
  data: () => CssSiteData,
  tree: (context: CompletionContext) => Tree,
): (context: CompletionContext) => CompletionResult | null {
  return (context) => {
    const variable = context.matchBefore(/var\(\s*--[\w-]*$/);
    if (variable !== null) {
      const from = variable.from + variable.text.indexOf("--");
      return {
        from,
        options: data().variables.map((name): Completion => ({ label: name, type: "variable" })),
        validFor: /^--[\w-]*$/,
      };
    }
    const selector = context.matchBefore(/[.#][\w-]*$/);
    if (selector === null || inDeclarations(tree(context), context.pos)) return null;
    const site = data();
    const isClass = selector.text.startsWith(".");
    const names = isClass ? site.classes : site.ids;
    return {
      from: selector.from + 1,
      options: names.map(
        (name): Completion => ({
          label: name,
          type: isClass ? "class" : "constant",
          ...(isClass ? {} : { detail: t("stylesheet.complete.anchor") }),
        }),
      ),
      validFor: /^[\w-]*$/,
    };
  };
}

/** What the stylesheet's lint reads besides the CSS: the site, and what its pages have. */
export type CssLintData = {
  readonly site: SiteDoc;
  /** The variables the site's styles define: the theme's, then Tailwind's (`--text-xl`). */
  readonly variables: readonly string[];
  /** The classes and ids the pages have; left out, rules aren't checked for matching nothing. */
  readonly used?: UsedSelectors | undefined;
  /** Whether the owner has confirmed the addresses Settings allow (#649). */
  readonly allowListConfirmed: boolean;
};

/**
 * What's wrong in `css`, as the editor underlines it: what isn't valid CSS, a variable the theme
 * doesn't have, a file from another website (Site Check's *Must fix*, C8) and a rule that matches
 * nothing on the site (its *Tip*, 6.8).
 */
export function cssDiagnostics(css: string, tree: Tree, data: CssLintData): Diagnostic[] {
  const found: Diagnostic[] = [];
  tree.iterate({
    enter: (node) => {
      if (!node.type.isError) return;
      const from = Math.min(node.from, Math.max(css.length - 1, 0));
      found.push({
        from,
        to: Math.min(Math.max(node.to, from + 1), css.length),
        severity: "error",
        message: t("stylesheet.lint.invalid"),
      });
    },
  });
  const known = new Set([...data.variables, ...ownVariables(css)]);
  // A name with a fallback after it is read knowing it may be missing, as Tailwind's own are.
  for (const match of css.matchAll(/var\(\s*(--[\w-]+)\s*(,?)/g)) {
    const name = match[1] ?? "";
    if (known.has(name) || match[2] === "," || name.startsWith("--tw-")) continue;
    const from = (match.index ?? 0) + match[0].indexOf(name);
    found.push({
      from,
      to: from + name.length,
      severity: "warning",
      message: t("stylesheet.lint.variable", { name }),
    });
  }
  const allowed = data.allowListConfirmed ? data.site.settings.allowedExternalUrls : [];
  const kept = (data.site.code.bundled ?? []).map((file) => file.url);
  let searchFrom = 0;
  for (const { url } of cssResources(css)) {
    if (isAllowed(url, allowed) || isAllowed(url, kept)) continue;
    const from = css.indexOf(url, searchFrom);
    if (from === -1) continue;
    searchFrom = from + url.length;
    found.push({
      from,
      to: from + url.length,
      severity: "error",
      message: t("stylesheet.lint.external"),
    });
  }
  if (data.used !== undefined) {
    for (const rule of unusedCssRules(css, withCodeWords(data.site, data.used))) {
      found.push({
        from: rule.from,
        to: rule.to,
        severity: "info",
        message: t("stylesheet.lint.unused"),
      });
    }
  }
  return found.sort((a, b) => a.from - b.from);
}
