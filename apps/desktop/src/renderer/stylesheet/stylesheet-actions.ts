import { t } from "@webforge/i18n";
import { anchorFrom, type NodeAdvanced, type SiteDoc, siteToSnapshot } from "@webforge/model";
import { appearanceClassGroups } from "@webforge/site-components";
import type { EditorSession } from "../editor/editor-session.js";
import { type FieldTarget, fieldTarget } from "../editor/field-target.js";
import type { ItemCssApi } from "../editor/item-css.js";
import { elementName } from "../editor/labels.js";
import { classesOfHtml, siteSelectors } from "../editor/site-css.js";

/** Typing in the stylesheet merges into one undo step until a pause (CT-8). */
const TYPING_KEY = "site-css";

/** The session's parts the stylesheet's actions use. */
export type StylesheetSession = Pick<EditorSession, "history" | "ui" | "library" | "edit">;

/** The stylesheet as `site` has it. */
export const stylesheetOf = (site: SiteDoc): string => site.code.css;

/**
 * Sets the site's `custom.css` to `css` as the person types it (CT-8, 6.8): one undo step for each
 * stretch of typing, "Edited site CSS", which the next pause ends.
 */
export function editStylesheet(session: StylesheetSession, css: string): void {
  if (stylesheetOf(session.history.document.getState()) === css) return;
  session.edit(
    "props",
    t("stylesheet.history.edited"),
    (draft) => {
      draft.code.css = css;
    },
    { coalesceKey: TYPING_KEY },
  );
}

/** The selected element and how to change it, or nothing when none is selected. */
function selected(session: StylesheetSession): FieldTarget | undefined {
  const { pageId, nodeId } = session.ui.getState();
  return fieldTarget(session.history.document.getState(), session.library, pageId, nodeId);
}

/** The element's own CSS classes (*CSS classes* in its Advanced tab), as a list. */
const ownClasses = (advanced: NodeAdvanced | undefined): string[] =>
  (advanced?.className ?? "").split(/\s+/).filter((name) => name !== "");

/**
 * A class for `target` no element of the site has and the stylesheet doesn't name yet, after the
 * element's name: `opening-times`, `heading-2`.
 */
function newClassFor(session: StylesheetSession, target: FieldTarget, site: SiteDoc): string {
  const { classes } = siteSelectors(site, session);
  const named = new Set(site.code.css.match(/[\w-]+/g));
  return anchorFrom(
    elementName(target.node, session.library, site.sharedSections),
    (name) => classes.has(name) || named.has(name),
  );
}

/** `css` with `rule` after it, on a line of its own, and where the rule starts. */
function appended(css: string, rule: string): { readonly css: string; readonly at: number } {
  const before = css.trimEnd();
  const separator = before === "" ? "" : "\n\n";
  return { css: `${before}${separator}${rule}\n`, at: before.length + separator.length };
}

/** What *Target this element* did: where the caret goes, in the stylesheet as it is now. */
export type Targeted = { readonly caret: number } | { readonly refused: string };

/**
 * *Target this element* (CT-8): adds an empty rule for the selected element at the end of the
 * stylesheet, for the caret to go into. Its selector is the element's anchor (`#opening-times`),
 * or a class of its own, made from its name and added to its *CSS classes* in the same step. A
 * class already its own, made this way, is used again.
 */
export function targetSelected(session: StylesheetSession): Targeted {
  const target = selected(session);
  if (target === undefined) return { refused: t("stylesheet.target.none") };
  const site = session.history.document.getState();
  const advanced = target.node.props.advanced as NodeAdvanced | undefined;
  const anchor = advanced?.anchorId;
  const name = elementName(target.node, session.library, site.sharedSections);
  const className = anchor === undefined ? newClassFor(session, target, site) : undefined;
  const selector = className === undefined ? `#${anchor}` : `.${className}`;
  const { css, at } = appended(stylesheetOf(site), `${selector} {\n  \n}`);
  session.edit("props", t("stylesheet.history.target", { element: name }), (draft) => {
    draft.code.css = css;
    if (className !== undefined) {
      target.write(draft, "advanced", (stored) => {
        const own = stored as NodeAdvanced | undefined;
        return { ...own, className: [...ownClasses(own), className].join(" ") };
      });
    }
  });
  // Inside the braces, on the empty line.
  return { caret: at + selector.length + " {\n  ".length };
}

/** The classes of the first element in `html`: the item's own element, as the export writes it. */
function rootClasses(html: string): Set<string> {
  const tag = /<[a-zA-Z][^>]*>/.exec(html.replace(/<!--[\s\S]*?-->/g, ""))?.[0] ?? "";
  return new Set(classesOfHtml(tag));
}

/** What *Move this look to CSS* did. */
export type Moved =
  | { readonly caret: number; readonly moved: number; readonly kept: number }
  | { readonly refused: string };

/**
 * *Move this look to CSS* (CT-8): the selected element's own Appearance settings (not its kind's
 * look in the theme) become a rule in the stylesheet, under a class of its own added to it, and are
 * cleared, in one undo step: the reverse of setting them in Style. The rule is each setting's
 * classes as the export compiles them, in the theme's variables, so it still follows the theme. A
 * setting that styles a part inside the element (a section's title) stays, as a rule for the
 * element itself would style something else; how many did is returned with how many moved.
 */
export async function moveLookToCss(session: StylesheetSession, api: ItemCssApi): Promise<Moved> {
  const target = selected(session);
  if (target === undefined) return { refused: t("stylesheet.target.none") };
  const { pageId } = session.ui.getState();
  const site = session.history.document.getState();
  const groups = appearanceClassGroups(target.node.props);
  if (groups.length === 0) return { refused: t("stylesheet.move.nothing") };
  const answer = await api.itemHtml({
    snapshot: siteToSnapshot(site, new Map()),
    sizes: {},
    pageId,
    nodeId: target.id,
  });
  if (answer.status === "failed" || answer.html === null || answer.html === "") {
    return { refused: t("stylesheet.move.failed") };
  }
  const onElement = rootClasses(answer.html);
  const split = (classes: string) => classes.split(/\s+/).filter((name) => name !== "");
  const movable = groups.filter((group) =>
    split(group.classes).every((name) => onElement.has(name)),
  );
  if (movable.length === 0) return { refused: t("stylesheet.move.inside") };
  const classes = [...new Set(movable.flatMap((group) => split(group.classes)))];
  const compiled = await api.classCss(site.theme, classes);
  if (compiled.status === "failed") return { refused: t("stylesheet.move.failed") };

  // Each class's rule, under the element's own class instead.
  const now = session.history.document.getState();
  const current = selected(session);
  if (current === undefined || current.node.props.id !== target.node.props.id) {
    return { refused: t("stylesheet.target.none") };
  }
  const advanced = current.node.props.advanced as NodeAdvanced | undefined;
  const className = newClassFor(session, current, now);
  const rules = classes.flatMap((name, index) => {
    const css = compiled.css[index];
    if (css === null || css === undefined || css.trim() === "") return [];
    return [
      css
        .trim()
        .split(`.${CSS.escape(name)}`)
        .join(`.${className}`),
    ];
  });
  const { css, at } = appended(stylesheetOf(now), rules.join("\n"));
  const name = elementName(current.node, session.library, now.sharedSections);
  session.edit("props", t("stylesheet.history.move", { element: name }), (draft) => {
    draft.code.css = css;
    for (const group of movable) current.write(draft, group.field, () => undefined);
    current.write(draft, "advanced", () => ({
      ...advanced,
      className: [...ownClasses(advanced), className].join(" "),
    }));
  });
  return { caret: at, moved: movable.length, kept: groups.length - movable.length };
}
