import { plural, t } from "@webforge/i18n";
import {
  copiedNodeId,
  findNode,
  isPageIn,
  isSharedCopy,
  type PageId,
  pageEntryOf,
  type SiteDoc,
} from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import type { EditorSession } from "../editor/editor-session.js";
import type { SettingsRegistry } from "../editor/settings-registry.js";
import { reportFailure } from "../log.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import type { CommandRegistry } from "../shell/commands.js";
import type { SiteWideConfirm } from "../shell/confirm-site-wide.js";
import type { PanelRegistry } from "../shell/panels.js";
import {
  elementsAt,
  type FindOptions,
  findInSite,
  groupOf,
  replaceInSite,
  type SpotGroup,
  type SpotMatches,
  type TextSpot,
} from "./find-text.js";

/** What finding and replacing work with: the site, and where a match is shown. */
export type FindActions = {
  readonly session: EditorSession;
  readonly panels: Pick<PanelRegistry, "show">;
  readonly settings: Pick<SettingsRegistry, "show">;
  readonly commands: Pick<CommandRegistry, "run">;
  readonly siteWide: Pick<SiteWideConfirm, "confirmSiteWide">;
};

/** The Pages panel: where a page's name in the menu is changed (S5). */
const SITE_PANEL_ID = "site";

/** The name a group of matches is listed under: its page, the Header, a shared section… */
export function groupName(site: SiteDoc, group: SpotGroup): string {
  if (group === "header") return t("findReplace.group.header");
  if (group === "footer") return t("findReplace.group.footer");
  if (group === "settings") return t("findReplace.group.settings");
  const page = pageEntryOf(site.pages, group);
  if (page !== undefined) return page.title.trim() === "" ? page.slug : page.title;
  const shared = Object.values(site.sharedSections).find((entry) => entry.id === group);
  return t("findReplace.group.shared", { name: shared?.name ?? group });
}

/** What a match is in: "Heading · Text", "Opening times · Text", "Title". */
export function spotName(site: SiteDoc, library: ComponentLibrary, spot: TextSpot): string {
  switch (spot.kind) {
    case "page":
      switch (spot.field) {
        case "title":
          return t("pageSettings.pageTitle");
        case "navLabel":
          return t("menu.renameDialog.label");
        case "description":
          return t("pageSettings.metaDescription");
      }
      break;
    case "settings":
      switch (spot.field) {
        case "general.name":
          return t("site.settings.name");
        case "general.description":
          return t("site.settings.siteDescription");
        case "contact.businessName":
          return t("site.settings.businessName");
        case "contact.address":
          return t("site.settings.address");
        case "contact.openingHoursNote":
          return t("site.settings.openingHoursNote");
      }
      break;
    case "element": {
      const component = library.components[spot.type];
      const def = component?.fields[spot.field];
      const field =
        spot.item !== undefined && def?.kind === "list"
          ? (def.fields[spot.item.field]?.label ?? spot.item.field)
          : (def?.label ?? spot.field);
      const element = elementName(site, spot) ?? component?.label ?? spot.type;
      return t("findReplace.inField", { element, field });
    }
  }
  return "";
}

/** The name the owner gave an element in Layers, if any. */
function elementName(site: SiteDoc, spot: TextSpot & { kind: "element" }): string | undefined {
  const node = findNode(elementsAt(site, spot.on), (each) => each.props.id === spot.nodeId);
  const name = node?.props.layerName?.trim();
  return name === undefined || name === "" ? undefined : name;
}

/** A page holding a copy of shared section `sharedId`, and the copy's id: the shown page first. */
function pageWithCopy(
  site: SiteDoc,
  sharedId: string,
  shown: PageId,
): { readonly pageId: PageId; readonly copyId: string } | undefined {
  for (const pageId of [shown, ...site.pageOrder]) {
    const copy = site.pages[pageId]?.doc.content
      .filter(isSharedCopy)
      .find((node) => node.props.sharedSectionId === sharedId);
    if (copy !== undefined) return { pageId, copyId: copy.props.id };
  }
  return undefined;
}

/**
 * Shows where `spot` is: an element selected on its page (the Header's and Footer's on the page
 * shown, a shared section's in a copy of it), a page's title or description in its Page Settings,
 * its name in the menu in the Pages panel, a business detail in Site Settings.
 */
export function showSpot(spot: TextSpot, { session, panels, settings, commands }: FindActions) {
  const site = session.history.document.getState();
  switch (spot.kind) {
    case "element": {
      const { on, nodeId } = spot;
      if (on === "header" || on === "footer") {
        session.select(nodeId);
      } else if (isPageIn(site.pages, on)) {
        session.showPage(on);
        session.select(nodeId);
      } else {
        const holder = pageWithCopy(site, on, session.ui.getState().pageId);
        if (holder === undefined) return;
        session.showPage(holder.pageId);
        session.select(copiedNodeId(holder.copyId, nodeId));
      }
      return;
    }
    case "page":
      if (site.pages[spot.pageId] === undefined) return;
      session.showPage(spot.pageId);
      if (spot.field === "navLabel") panels.show(SITE_PANEL_ID);
      else commands.run(COMMAND_IDS.pageSettings);
      return;
    case "settings": {
      const section = spot.field.startsWith("general.") ? "general" : "contact";
      settings.show("site", section).catch((error: unknown) => {
        reportFailure("findReplace.settings", error);
      });
      return;
    }
  }
}

/** The quoted text for an undo label, shortened: "'Smith'". */
const quoted = (text: string) => (text.length > 40 ? `${text.slice(0, 39)}…` : text);

/** Replaces the match at `occurrence` in `spot`: one undo step. */
export function replaceOne(
  session: EditorSession,
  options: FindOptions,
  replacement: string,
  spot: TextSpot,
  occurrence: number,
): void {
  session.flush();
  session.edit(
    "props",
    t("findReplace.history.replacedOne", {
      find: quoted(options.query),
      replace: quoted(replacement),
    }),
    (draft) => {
      replaceInSite(draft, session.library, options, replacement, [spot], occurrence);
    },
  );
}

/** The pages a change to `groups` shows on: each one's, a shared section's copies', or all. */
function pagesChanged(site: SiteDoc, groups: ReadonlySet<SpotGroup>): number {
  if (groups.has("header") || groups.has("footer") || groups.has("settings")) {
    return site.pageOrder.length;
  }
  const pages = new Set<PageId>();
  for (const pageId of site.pageOrder) {
    const content = site.pages[pageId]?.doc.content ?? [];
    const holdsCopy = content
      .filter(isSharedCopy)
      .some((node) => groups.has(node.props.sharedSectionId));
    if (groups.has(pageId) || holdsCopy) pages.add(pageId);
  }
  return pages.size;
}

/** The places `matches` are in: each page, the Header, the Footer, a shared section, Settings. */
export const placesOf = (matches: readonly SpotMatches[]): Set<SpotGroup> =>
  new Set(matches.map(({ spot }) => groupOf(spot)));

/**
 * Replaces every match of `options` with `replacement`, as one undo step named after it
 * ("Replaced 'Smith' with 'Smyth' in 4 places"). A change to more than one page asks first, as
 * any site-wide change does (D7), which saves a version. A shared section is replaced once: its
 * matches are its own, never its copies'. Resolves with how many places changed.
 */
export async function replaceAll(
  { session, siteWide }: Pick<FindActions, "session" | "siteWide">,
  options: FindOptions,
  replacement: string,
): Promise<number> {
  session.flush();
  const before = session.history.document.getState();
  const found = findInSite(before, session.library, options);
  if (found.length === 0) return 0;
  const places = placesOf(found);
  const pages = pagesChanged(before, places);
  const label = plural("findReplace.history.replacedAll", places.size, {
    find: quoted(options.query),
    replace: quoted(replacement),
  });
  if (pages > 1) {
    const confirmed = await siteWide.confirmSiteWide({
      action: t("findReplace.confirm.action", {
        find: quoted(options.query),
        replace: quoted(replacement),
      }),
      confirm: t("findReplace.replaceAll"),
      affectedPages: pages,
    });
    if (!confirmed) return 0;
  }
  // Found again: the site may have changed while the question was open.
  const site = session.history.document.getState();
  const spots = findInSite(site, session.library, options).map(({ spot }) => spot);
  let changed: TextSpot[] = [];
  session.edit("props", label, (draft) => {
    changed = replaceInSite(draft, session.library, options, replacement, spots);
  });
  return placesOf(changed.map((spot) => ({ spot, matches: [] }))).size;
}
