import { plural, t } from "@webforge/i18n";
import {
  copiedNodeId,
  designAt,
  elementsAt,
  findNode,
  isPageIn,
  isSharedCopy,
  type PageId,
  pageEntryOf,
  pageWithCopy,
  type SiteDoc,
} from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import type { EditorSession } from "../editor/editor-session.js";
import type { SettingsRegistry } from "../editor/settings-registry.js";
import { inDesign, postShowingDesign } from "../editor/shared-layout.js";
import { reportFailure } from "../log.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import type { CommandRegistry } from "../shell/commands.js";
import type { SiteWideConfirm } from "../shell/confirm-site-wide.js";
import type { PanelRegistry } from "../shell/panels.js";
import {
  type FindOptions,
  findInSite,
  groupOf,
  replaceInSite,
  type SpotGroup,
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
  if (group === "menu") return t("findReplace.group.menu");
  if (group === "settings") return t("findReplace.group.settings");
  const page = pageEntryOf(site.pages, group);
  if (page !== undefined) return page.title.trim() === "" ? page.slug : page.title;
  const design = designAt(site, group);
  if (design !== undefined) {
    return t("findReplace.group.design", { name: t("history.namedItem", { name: design.name }) });
  }
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
    case "menu": {
      const item = site.menu.items
        .flatMap((each) => (each.kind === "group" ? [each, ...each.children] : [each]))
        .find((each) => each.id === spot.itemId);
      return t("findReplace.menuItem", { kind: t(`menu.kind.${item?.kind ?? "link"}`) });
    }
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

/**
 * Shows where `spot` is: an element selected on its page (the Header's and Footer's on the page
 * shown, a shared section's in a copy of it, a Blog design's on a post, #936), a page's title or
 * description in its Page Settings, its name in the menu and the menu's own labels in the Pages
 * panel, a business detail in Site Settings.
 */
export function showSpot(spot: TextSpot, { session, panels, settings, commands }: FindActions) {
  const site = session.history.document.getState();
  switch (spot.kind) {
    case "element": {
      const { on, nodeId } = spot;
      const design = designAt(site, on);
      if (on === "header" || on === "footer") {
        session.select(nodeId);
      } else if (isPageIn(site.pages, on)) {
        session.showPage(on);
        session.select(nodeId);
      } else if (design !== undefined) {
        const post = postShowingDesign(site, design.id, session.ui.getState().pageId);
        if (post === undefined) return;
        session.showPage(post);
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
    case "menu":
      panels.show(SITE_PANEL_ID);
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

/**
 * Replaces the match at `occurrence` in `spot`: one undo step, named by the Blog when the match is
 * in its design (#936), which every post shows.
 */
export function replaceOne(
  session: EditorSession,
  options: FindOptions,
  replacement: string,
  spot: TextSpot,
  occurrence: number,
): void {
  session.flush();
  const site = session.history.document.getState();
  const designId = spot.kind === "element" ? designAt(site, spot.on)?.id : undefined;
  const design = designId === undefined ? "" : inDesign(site, designId);
  session.edit(
    "props",
    t("findReplace.history.replacedOne", {
      find: quoted(options.query),
      replace: quoted(replacement),
    }) + design,
    (draft) => {
      replaceInSite(draft, session.library, options, replacement, [spot], occurrence);
    },
  );
}

/**
 * The pages a change to `groups` shows on: each one's, a shared section's copies', a Blog design's
 * posts (#936), or all.
 */
function pagesChanged(site: SiteDoc, groups: ReadonlySet<SpotGroup>): number {
  if (["header", "footer", "menu", "settings"].some((shown) => groups.has(shown))) {
    return site.pageOrder.length;
  }
  const pages = new Set<PageId>();
  for (const pageId of site.pageOrder) {
    const page = site.pages[pageId];
    const content = page?.doc.content ?? [];
    const holdsCopy = content
      .filter(isSharedCopy)
      .some((node) => groups.has(node.props.sharedSectionId));
    const showsDesign = page?.collection !== undefined && groups.has(page.collection);
    if (groups.has(pageId) || holdsCopy || showsDesign) pages.add(pageId);
  }
  return pages.size;
}

/** The places `spots` are in: each page, the Header, the Footer, a shared section, Settings. */
const placesOf = (spots: readonly TextSpot[]): Set<SpotGroup> => new Set(spots.map(groupOf));

/** The spots of every match `options` finds in `site`. */
const spotsOf = (site: SiteDoc, library: ComponentLibrary, options: FindOptions) =>
  findInSite(site, library, options).map(({ spot }) => spot);

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
  const { library } = session;
  const before = session.history.document.getState();
  const found = spotsOf(before, library, options);
  if (found.length === 0) return 0;
  const pages = pagesChanged(before, placesOf(found));
  const quotes = { find: quoted(options.query), replace: quoted(replacement) };
  if (pages > 1) {
    const confirmed = await siteWide.confirmSiteWide({
      action: t("findReplace.confirm.action", quotes),
      confirm: t("findReplace.replaceAll"),
      affectedPages: pages,
    });
    if (!confirmed) return 0;
  }
  // Found again, as the site is now: it may have changed while the question was open. Tried on a
  // copy first, so the label counts the places that change, not those a replacement skips.
  const site = session.history.document.getState();
  const spots = spotsOf(site, library, options);
  const changed = placesOf(
    replaceInSite(structuredClone(site), library, options, replacement, spots),
  );
  if (changed.size === 0) return 0;
  session.edit(
    "props",
    plural("findReplace.history.replacedAll", changed.size, quotes),
    (draft) => {
      replaceInSite(draft, library, options, replacement, spots);
    },
  );
  return changed.size;
}
