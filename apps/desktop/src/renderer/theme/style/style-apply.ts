import { t } from "@webforge/i18n";
import type { SiteDoc } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import { applyLookToAll, lookChange, lookFieldsOf } from "../../clipboard/index.js";
import type { EditorSelection, EditorSession } from "../../editor/editor-session.js";
import { type FieldTarget, fieldTarget } from "../../editor/field-target.js";
import type { SiteWideConfirm } from "../../shell/confirm-site-wide.js";
import { setLook, type ThemeAsks } from "../theme-edits.js";

/**
 * Where *Style this ‹kind›…*'s changes apply (3.13a, CT-2): the item alone, every one of its kind on
 * the page or the site (2.27), or the theme's look for its kind (3.12).
 */
export const STYLE_SCOPES = ["this", "page", "site", "theme"] as const;

/** One of {@link STYLE_SCOPES}. */
export type StyleScope = (typeof STYLE_SCOPES)[number];

/** What the dialog works on: the editor's session. */
type StyleSession = Pick<
  EditorSession,
  "history" | "ui" | "library" | "edit" | "flush" | "cancelGesture"
>;

/** The item selected, if it has a look to style: one element alone, with Appearance fields. */
export function styledItem(session: StyleSession): FieldTarget | undefined {
  return styledItemIn(session.history.document.getState(), session.library, session.ui.getState());
}

/**
 * {@link styledItem} in `site` for `selection`: from what a component draws, so a compiled
 * component works it out again as they change.
 */
export function styledItemIn(
  site: SiteDoc,
  library: ComponentLibrary,
  { pageId, nodeId, others = [] }: EditorSelection,
): FieldTarget | undefined {
  if (others.length > 0) return undefined;
  const target = fieldTarget(site, library, pageId, nodeId);
  return target !== undefined && lookFieldsOf(target.component).length > 0 ? target : undefined;
}

/**
 * Opens the dialog's changes: the step they come after, so they become one step when it is done.
 * A change in progress ends first, and nothing the dialog changes merges into an earlier step.
 */
export function openStyle(session: StyleSession): string | null {
  session.flush();
  session.history.breakCoalescing();
  const { entries, cursor } = session.history.state.getState();
  return entries[cursor - 1]?.id ?? null;
}

/**
 * Takes back what the dialog changed (Cancel, Esc): its changes as one step, undone, so the item
 * is as it was and Redo can bring them back.
 */
export function cancelStyle(session: StyleSession, since: string | null): void {
  session.cancelGesture();
  if (session.history.mergeSince(since, t("style.history.this", { item: itemName(session) }))) {
    session.history.undo();
  }
}

/** The selected item's kind's name ("Feature"), or a general word with none. */
function itemName(session: StyleSession): string {
  return styledItem(session)?.component.label ?? t("style.item");
}

/** What applying asks with: before a change beyond the page (D7), and a theme's name (2.23). */
export type StyleAsks = {
  readonly siteWide?: Pick<SiteWideConfirm, "confirmSiteWide"> | undefined;
  readonly theme?: ThemeAsks;
  /** Says why nothing more changed ("Every Feature on this page has this look already."). */
  readonly notify?: ((message: string) => void) | undefined;
};

/**
 * Applies what the dialog changed, in `scope` (3.13a, CT-2), as one labelled step with its own
 * changes: to the item alone; to every other one of its kind on the page or the site, with the
 * count and D7's question beyond the page (2.27); or as the theme's look for its kind, which the
 * item then follows, D7 asking when it restyles others (3.12). Resolves false when a question was
 * declined, so the dialog stays open with its changes; true when it is done.
 */
export async function applyStyle(
  session: StyleSession,
  since: string | null,
  scope: StyleScope,
  asks: StyleAsks = {},
): Promise<boolean> {
  session.cancelGesture();
  const item = styledItem(session);
  const name = item?.component.label ?? t("style.item");
  const done = (applied: StyleScope) => {
    session.history.mergeSince(since, t(`style.history.${applied}`, { item: name }));
    return true;
  };
  if (item === undefined || scope === "this") return done("this");
  if (scope === "page" || scope === "site") {
    const change = lookChange(session, scope);
    if (change === undefined || change.targets.length === 0) {
      asks.notify?.(t(`look.same.${scope}`, { item: name }));
      return done("this");
    }
    return (await applyLookToAll(session, scope, asks.siteWide)) ? done(scope) : false;
  }
  return (await makeThemeLook(session, item, asks.theme)) ? done("theme") : false;
}

/**
 * The item's own Appearance values as the theme's look for its kind, then taken off the item,
 * which follows the look again: false when the theme's change was declined.
 */
async function makeThemeLook(
  session: StyleSession,
  item: FieldTarget,
  asks: ThemeAsks,
): Promise<boolean> {
  const { node, component } = item;
  const own = Object.fromEntries(
    lookFieldsOf(component).flatMap((name) =>
      node.props[name] === undefined ? [] : [[name, node.props[name]]],
    ),
  );
  if (Object.keys(own).length === 0) return true;
  const look: Readonly<Record<string, unknown>> =
    session.history.document.getState().theme.looks?.[node.type] ?? {};
  const differs = Object.keys(own).some(
    (name) => JSON.stringify(look[name]) !== JSON.stringify(own[name]),
  );
  if (differs && !(await setLook(session, asks, node.type, component.label, own))) return false;
  // Found again: the theme's change may have asked first, and the item is written as it is now.
  const now = styledItem(session);
  if (now === undefined) return true;
  session.edit("props", t("style.history.theme", { item: component.label }), (draft) => {
    for (const name of Object.keys(own)) now.write(draft, name, () => undefined);
  });
  return true;
}
