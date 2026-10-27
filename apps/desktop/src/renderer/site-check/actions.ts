import { t } from "@webforge/i18n";
import {
  copiedNodeId,
  isDeviceName,
  isNodeDoc,
  isSharedCopy,
  type NodeDoc,
  type PageId,
  pageTitle,
  type SiteDoc,
  slugsInFolder,
  uniqueSlug,
} from "@webforge/model";
import type { Finding, FindingPlace } from "@webforge/site-check";
import type { EditorSession } from "../editor/editor-session.js";
import { reportFailure } from "../log.js";
import type { SettingsRegistry } from "../settings/index.js";
import type { PanelRegistry } from "../shell/panels.js";
import { THEME_PANEL_ID } from "../theme/index.js";

/** What Site Check's jumps and fixes reach. */
export type SiteCheckActions = {
  readonly session: Pick<EditorSession, "history" | "ui" | "edit" | "showPage" | "select">;
  readonly panels: Pick<PanelRegistry, "show">;
  readonly settings: Pick<SettingsRegistry, "show">;
};

/** The Pages panel's and the Media panel's ids (1.8, 1.9). */
const SITE_PANEL_ID = "site";
const MEDIA_PANEL_ID = "media";

/** Opens Site Settings at the web address. */
function showAddress(settings: SiteCheckActions["settings"]): void {
  settings.show("site", "address").catch((error: unknown) => {
    reportFailure("siteCheck.address", error);
  });
}

/**
 * A page holding a copy of shared section `sharedId`, and the copy's id there: where one of its
 * elements is shown. The page shown first, if it holds one.
 */
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
 * Shows where `place` is (F-CHK-1, click to jump): an element selected on its page (the Header's
 * and Footer's on the page shown, a shared section's in a copy of it), a page in the Pages panel,
 * Media, the Theme panel, or Site Settings at the web address.
 */
export function jumpTo(place: FindingPlace, { session, panels, settings }: SiteCheckActions): void {
  const site = session.history.document.getState();
  switch (place.kind) {
    case "element": {
      const { on, nodeId } = place;
      if (on === "header" || on === "footer") {
        session.select(nodeId);
      } else if (Object.hasOwn(site.pages, on)) {
        session.showPage(on as PageId);
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
      if (site.pages[place.pageId] !== undefined) session.showPage(place.pageId);
      panels.show(SITE_PANEL_ID);
      return;
    case "menu":
      panels.show(SITE_PANEL_ID);
      return;
    case "media":
      panels.show(MEDIA_PANEL_ID);
      return;
    case "theme":
      panels.show(THEME_PANEL_ID);
      return;
    case "address":
      showAddress(settings);
      return;
  }
}

/** The text of the first heading on `nodes`: a Heading's, or a section's title. */
function firstHeading(nodes: readonly NodeDoc[]): string | undefined {
  for (const node of nodes) {
    if (node.props.hidden === true) continue;
    const text = node.type === "Heading" ? node.props.text : node.props.title;
    if (typeof text === "string" && pageTitle(text) !== "") return pageTitle(text);
    for (const value of Object.values(node.props)) {
      if (!Array.isArray(value)) continue;
      const found = firstHeading(value.filter(isNodeDoc));
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/** "page 'About'", for the history's labels. */
const pageItem = (name: string) => t("pages.item", { name });

/**
 * Renames page `pageId`'s file, and its folder's, where Windows keeps the name for a device (R16):
 * `con` → `con-2`, as `uniqueSlug` makes new names. A folder is renamed for every page in it. One
 * undo step.
 */
function renameDeviceNames({ session }: SiteCheckActions, pageId: PageId): void {
  const page = session.history.document.getState().pages[pageId];
  if (page === undefined) return;
  session.edit("props", t("siteCheck.history.renamed", { item: pageItem(page.title) }), (draft) => {
    const target = draft.pages[pageId];
    if (target === undefined) return;
    const folder = target.folder;
    if (folder !== undefined && folder.split("/").some(isDeviceName)) {
      const segments = folder.split("/");
      const renamed = segments
        .map((segment, index) => {
          if (!isDeviceName(segment)) return segment;
          // Free among the folders beside it.
          const parent = segments.slice(0, index).join("/");
          const siblings = new Set(
            Object.values(draft.pages).flatMap((each) => {
              const parts = each.folder?.split("/") ?? [];
              return parts.slice(0, index).join("/") === parent && parts[index] !== undefined
                ? [parts[index]]
                : [];
            }),
          );
          return uniqueSlug(segment, siblings);
        })
        .join("/");
      for (const each of Object.values(draft.pages)) {
        if (each.folder === folder) each.folder = renamed;
        else if (each.folder?.startsWith(`${folder}/`)) {
          each.folder = `${renamed}${each.folder.slice(folder.length)}`;
        }
      }
    }
    if (isDeviceName(target.slug)) {
      target.slug = uniqueSlug(target.slug, slugsInFolder(draft, target.folder, pageId));
    }
  });
}

/** Gives page `pageId` the title `title`. One undo step. */
function giveTitle({ session }: SiteCheckActions, pageId: PageId, title: string): void {
  session.edit("props", t("siteCheck.history.titled", { item: pageItem(title) }), (draft) => {
    const target = draft.pages[pageId];
    if (target !== undefined) target.title = title;
  });
}

/**
 * The *Fix* for `finding` of `rule`, if it has one (F-CHK-1): a page's Windows device name renamed
 * (R16), a missing title taken from the page's first heading, the web address asked for in Site
 * Settings. `undefined` when Site Check can only show where it is.
 */
export function fixFor(
  rule: string,
  finding: Finding,
  actions: SiteCheckActions,
): (() => void) | undefined {
  const { place } = finding;
  const site = actions.session.history.document.getState();
  if (rule === "deviceNames" && place.kind === "page") {
    return () => renameDeviceNames(actions, place.pageId);
  }
  if (rule === "pageTitles" && place.kind === "page") {
    const title = firstHeading(site.pages[place.pageId]?.doc.content ?? []);
    return title === undefined ? undefined : () => giveTitle(actions, place.pageId, title);
  }
  if (rule === "webAddress") {
    return () => showAddress(actions.settings);
  }
  return undefined;
}
