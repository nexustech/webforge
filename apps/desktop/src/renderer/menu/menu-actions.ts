import { t } from "@webforge/i18n";
import {
  type LinkValue,
  type MenuDoc,
  type MenuItem,
  type MenuItemId,
  type MenuLeaf,
  newId,
  type SiteDoc,
  syncMenuWithPages,
} from "@webforge/model";
import type { EditKind, EditorSession } from "../editor/editor-session.js";
import { applyAnchor, type LinkFieldChange } from "../editor/link-change.js";

/**
 * The menu editor's changes (F-ED-17): each one undo step named after its item ("Added menu item
 * 'Book now'"). Adding, moving or removing an item makes the menu the person's own (`custom`), so
 * it stops following the page order; renaming, hiding and relinking keep it as it is.
 */

/** The parts of an editor session the menu editor uses. */
export type MenuSession = Pick<EditorSession, "history" | "edit">;

/** The longest label the model accepts. */
const MAX_LABEL = 100;

/** `label` as the model keeps it: trimmed and at most 100 characters. */
const cleanLabel = (label: string) => label.trim().slice(0, MAX_LABEL).trim();

/** What an item shows in the menu: its label, else its page's navigation label or title. */
export function itemLabel(site: SiteDoc, item: MenuItem): string {
  if (item.kind !== "page") return item.label;
  const page = site.pages[item.pageId];
  return item.label ?? page?.navLabel ?? page?.title ?? "";
}

/** How undo labels name an item: "menu item 'Book now'". */
const itemName = (site: SiteDoc, item: MenuItem) => t("menu.item", { name: itemLabel(site, item) });

/** Where item `id` is: its list (the menu's or a dropdown's), its index there, and its dropdown. */
function placeOf(
  menu: MenuDoc,
  id: MenuItemId,
): { list: MenuItem[]; index: number; group: MenuItem | undefined } | undefined {
  const index = menu.items.findIndex((item) => item.id === id);
  if (index !== -1) return { list: menu.items, index, group: undefined };
  for (const group of menu.items) {
    if (group.kind !== "group") continue;
    const inner = group.children.findIndex((item) => item.id === id);
    if (inner !== -1) return { list: group.children, index: inner, group };
  }
  return undefined;
}

/** Item `id` of the site's menu, if there is one. */
export function menuItem(site: SiteDoc, id: MenuItemId): MenuItem | undefined {
  const place = placeOf(site.menu, id);
  return place?.list[place.index];
}

/** Runs `change` on item `id` as one step labelled `label`, making the menu custom if `custom`. */
function editItem(
  session: MenuSession,
  id: MenuItemId,
  kind: EditKind,
  label: (site: SiteDoc, item: MenuItem) => string,
  change: (draft: SiteDoc, item: MenuItem, place: { list: MenuItem[]; index: number }) => void,
  custom = false,
): void {
  const site = session.history.document.getState();
  const item = menuItem(site, id);
  if (item === undefined) return;
  session.edit(kind, label(site, item), (draft) => {
    const place = placeOf(draft.menu, id);
    const current = place?.list[place.index];
    if (place === undefined || current === undefined) return;
    if (custom) draft.menu.follows = "custom";
    change(draft, current, place);
  });
}

/** Gives a section linked to for the first time its anchor, in the same step as the link. */
function applyLinkAnchor(draft: SiteDoc, site: SiteDoc, change: LinkFieldChange): void {
  if (change.anchor !== undefined) applyAnchor(draft, site, change.anchor);
}

/** A link item for `link`: a section item when it goes to a section of a page (G3). */
function linkItem(
  id: MenuItemId,
  kind: "link" | "button",
  label: string,
  link: LinkValue,
): MenuLeaf {
  if (kind === "link" && link.kind === "page" && link.anchor !== undefined) {
    return {
      id,
      kind: "section",
      label,
      link: { ...link, anchor: link.anchor },
      hidden: false,
    };
  }
  return { id, kind, label, link, hidden: false };
}

/** What the menu editor adds: a link or button with its label, or an empty dropdown. */
export type NewMenuItem =
  | { readonly kind: "link" | "button"; readonly label: string; readonly change: LinkFieldChange }
  | { readonly kind: "group"; readonly label: string };

/** Adds an item at the end of the menu, as one step. Returns its id, or `null` if not added. */
export function addMenuItem(session: MenuSession, add: NewMenuItem): MenuItemId | null {
  const label = cleanLabel(add.label);
  const link = add.kind === "group" ? undefined : add.change.link;
  if (label === "" || (add.kind !== "group" && link === undefined)) return null;
  const id = newId("menuItem");
  const site = session.history.document.getState();
  const item: MenuItem =
    add.kind === "group" || link === undefined
      ? { id, kind: "group", label, hidden: false, children: [] }
      : linkItem(id, add.kind, label, link);
  session.edit("insert", t("history.added", { item: itemName(site, item) }), (draft) => {
    draft.menu.follows = "custom";
    draft.menu.items.push(item);
    if (add.kind !== "group") applyLinkAnchor(draft, site, add.change);
  });
  return id;
}

/**
 * Renames item `id`. An empty name gives a page item its page's name back; other items keep their
 * name, as they need one.
 */
export function renameMenuItem(session: MenuSession, id: MenuItemId, label: string): void {
  const next = cleanLabel(label);
  const site = session.history.document.getState();
  const item = menuItem(site, id);
  if (item === undefined) return;
  // An empty name only means something for a page item that has a name of its own.
  const unchanged =
    next === "" ? item.kind !== "page" || item.label === undefined : next === itemLabel(site, item);
  if (unchanged) return;
  editItem(
    session,
    id,
    "props",
    (before, current) => t("menu.history.renamed", { name: itemLabel(before, current) }),
    (_draft, current) => {
      if (current.kind === "page" && next === "") delete current.label;
      else current.label = next;
    },
  );
}

/**
 * Changes link, button or section item `id`: its label and where it goes, as one step. A link to a
 * section becomes a section item, and back.
 */
export function editMenuLink(
  session: MenuSession,
  id: MenuItemId,
  label: string,
  change: LinkFieldChange,
): void {
  const link = change.link;
  const next = cleanLabel(label);
  const site = session.history.document.getState();
  const kind = menuItem(site, id)?.kind;
  if (
    link === undefined ||
    next === "" ||
    kind === undefined ||
    kind === "page" ||
    kind === "group"
  ) {
    return;
  }
  editItem(
    session,
    id,
    "props",
    (before, current) => t("menu.history.changed", { name: itemLabel(before, current) }),
    (draft, current, place) => {
      if (current.kind === "page" || current.kind === "group") return;
      const kind = current.kind === "button" ? "button" : "link";
      place.list[place.index] = {
        ...linkItem(current.id, kind, next, link),
        hidden: current.hidden,
      };
      applyLinkAnchor(draft, site, change);
    },
  );
}

/** Hides item `id` from the site's navigation, or shows it again; it stays in the editor. */
export function setMenuItemHidden(session: MenuSession, id: MenuItemId, hidden: boolean): void {
  const item = menuItem(session.history.document.getState(), id);
  if (item === undefined || item.hidden === hidden) return;
  editItem(
    session,
    id,
    "props",
    (before, current) =>
      t(hidden ? "menu.history.hid" : "menu.history.showed", { name: itemLabel(before, current) }),
    (_draft, current) => {
      current.hidden = hidden;
    },
  );
}

/** The menu's own list (`group` `null`), or dropdown `group`'s, if there is one. */
function listOf(menu: MenuDoc, group: MenuItemId | null): MenuItem[] | undefined {
  if (group === null) return menu.items;
  const found = menu.items.find((item) => item.id === group);
  return found?.kind === "group" ? found.children : undefined;
}

/** Where to move an item: into dropdown `group` (or the menu itself, `null`) at `index`. */
export type MenuPosition = { readonly group: MenuItemId | null; readonly index: number };

/**
 * Moves item `id` to `to`, counted once it has left its place, as one step. Dropdowns hold no
 * dropdowns (one level, so the mobile menu stays usable): a dropdown only moves within the menu.
 */
export function moveMenuItem(session: MenuSession, id: MenuItemId, to: MenuPosition): void {
  const site = session.history.document.getState();
  const from = placeOf(site.menu, id);
  const item = from?.list[from.index];
  if (from === undefined || item === undefined) return;
  const target = listOf(site.menu, to.group);
  if (target === undefined || (item.kind === "group" && to.group !== null)) return;
  const sameList = (from.group?.id ?? null) === to.group;
  const index = Math.max(0, Math.min(to.index, sameList ? target.length - 1 : target.length));
  if (sameList && index === from.index) return;
  editItem(
    session,
    id,
    "move",
    (before, current) => t("history.moved", { item: itemName(before, current) }),
    (draft, current, place) => {
      place.list.splice(place.index, 1);
      listOf(draft.menu, to.group)?.splice(index, 0, current);
    },
    true,
  );
}

/** Removes item `id` (a dropdown with what is in it) from the menu, as one step. */
export function removeMenuItem(session: MenuSession, id: MenuItemId): void {
  editItem(
    session,
    id,
    "remove",
    (before, current) => t("history.deleted", { item: itemName(before, current) }),
    (_draft, _current, place) => {
      place.list.splice(place.index, 1);
    },
    true,
  );
}

/**
 * Makes the menu follow the pages again: every page in page order, keeping their names and hidden
 * items; links, buttons and dropdowns go. One step, so undo brings them back.
 */
export function followPages(session: MenuSession): void {
  const site = session.history.document.getState();
  if (site.menu.follows === "pages") return;
  const pageItems = site.menu.items.flatMap((item) =>
    item.kind === "group" ? item.children : [item],
  );
  session.edit("props", t("menu.history.followPages"), (draft) => {
    draft.menu = syncMenuWithPages({ ...draft, menu: { follows: "pages", items: pageItems } });
  });
}
