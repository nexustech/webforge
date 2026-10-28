import { t } from "@webforge/i18n";
import {
  copiedNodeId,
  isDeviceName,
  isNodeDoc,
  isSharedCopy,
  type NodeDoc,
  type PageEntry,
  type PageId,
  pageTitle,
  type SiteDoc,
  slugsInFolder,
  uniqueSlug,
} from "@webforge/model";
import type { Finding, FindingPlace, SearchGuide } from "@webforge/site-check";
import type { EditorSession } from "../editor/editor-session.js";
import type { SettingsRegistry } from "../editor/settings-registry.js";
import { reportFailure } from "../log.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import type { CommandRegistry } from "../shell/commands.js";
import type { PanelRegistry } from "../shell/panels.js";
import { THEME_PANEL_ID } from "../theme/index.js";
import { type BundleActions, canBundle, downloadAndBundle } from "./bundle.js";

/** What Site Check's jumps and fixes reach. */
export type SiteCheckActions = {
  readonly session: Pick<EditorSession, "history" | "ui" | "edit" | "showPage" | "select">;
  readonly panels: Pick<PanelRegistry, "show">;
  readonly settings: Pick<SettingsRegistry, "show">;
  /** Runs Page Settings… for the page shown (3.17). */
  readonly commands: Pick<CommandRegistry, "run">;
  /** Opens a guide's page on another website in the browser (3.17). */
  readonly openGuide: (guide: SearchGuide) => void;
  /** Download and bundle (3.9), where the window offers it. */
  readonly bundle?: BundleActions;
};

/** Settings' Custom Code: its part's id and its one section's, as site-settings registers it. */
const CODE_SETTINGS = "code";

/** The Pages panel's and the Media panel's ids (1.8, 1.9). */
const SITE_PANEL_ID = "site";
const MEDIA_PANEL_ID = "media";

/** Opens Site Settings at `section`: the web address, the forms' service, Contact or Search engines. */
function showSiteSettings(
  settings: SiteCheckActions["settings"],
  section: "address" | "forms" | "contact" | "search",
): void {
  settings.show("site", section).catch((error: unknown) => {
    reportFailure(`siteCheck.${section}`, error);
  });
}

/** Settings, open on Custom Code (3.9): the site's own code, and the addresses it may load from. */
function showCode(settings: SiteCheckActions["settings"]): void {
  settings.show(CODE_SETTINGS, CODE_SETTINGS).catch((error: unknown) => {
    reportFailure("siteCheck.code", error);
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
 * Media, the Theme panel, Site Settings at the web address, Contact or Search engines, or Settings'
 * Custom Code. A guide opens its page in the browser.
 */
export function jumpTo(place: FindingPlace, actions: SiteCheckActions): void {
  const { session, panels, settings } = actions;
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
      showSiteSettings(settings, "address");
      return;
    case "contact":
      showSiteSettings(settings, "contact");
      return;
    case "search":
      showSiteSettings(settings, "search");
      return;
    case "code":
      showCode(settings);
      return;
    case "guide":
      actions.openGuide(place.guide);
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

/** The folders in folder `parent` (its segments): what a new name there must not be. */
function siblingFolders(pages: readonly PageEntry[], parent: readonly string[]): Set<string> {
  const depth = parent.length;
  return new Set(
    pages.flatMap((page) => {
      const parts = page.folder?.split("/") ?? [];
      const inParent = parent.every((segment, index) => parts[index] === segment);
      const name = parts[depth];
      return inParent && name !== undefined ? [name] : [];
    }),
  );
}

/**
 * Renames page `pageId`'s file, and its folders, where Windows keeps the name for a device (R16):
 * `con` → `con-2`, as `uniqueSlug` makes new names. A folder is renamed for every page in it, at any
 * depth, so its pages stay together (`aux/shop` and `aux/cakes` both move to `aux-2`). One undo
 * step.
 */
function renameDeviceNames({ session }: SiteCheckActions, pageId: PageId): void {
  const page = session.history.document.getState().pages[pageId];
  if (page === undefined) return;
  session.edit("props", t("siteCheck.history.renamed", { item: pageItem(page.title) }), (draft) => {
    const target = draft.pages[pageId];
    if (target === undefined) return;
    const pages = Object.values(draft.pages);
    const segments = target.folder?.split("/") ?? [];
    segments.forEach((segment, index) => {
      if (!isDeviceName(segment)) return;
      const parent = segments.slice(0, index);
      const name = uniqueSlug(segment, siblingFolders(pages, parent));
      for (const each of pages) {
        const parts = each.folder?.split("/") ?? [];
        if (parts.length > index && segments.slice(0, index + 1).every((s, i) => parts[i] === s)) {
          parts[index] = name;
          each.folder = parts.join("/");
        }
      }
      segments[index] = name;
    });
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
 * Settings, a file from another website kept with the site, Page Settings opened on a page
 * without a description, Site Settings opened where a search engine's setting or a business
 * detail goes. `undefined` when Site Check can only show where it is.
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
    return () => showSiteSettings(actions.settings, "address");
  }
  // A Contact form or Form posts to Site Settings' service; a Newsletter's address is its own,
  // which selecting it shows.
  if (rule === "forms" && finding.values?.form === "service") {
    return () => showSiteSettings(actions.settings, "forms");
  }
  if (rule === "pageDescriptions" && place.kind === "page") {
    return () => {
      actions.session.showPage(place.pageId);
      actions.commands.run(COMMAND_IDS.pageSettings);
    };
  }
  if (rule === "businessDetails") {
    return () => showSiteSettings(actions.settings, "contact");
  }
  // Search engines: whether they may list the site, and where Search Console's code goes.
  if (rule === "searchHidden" || rule === "searchConsole") {
    return () => showSiteSettings(actions.settings, "search");
  }
  // A file from another website: Download and bundle keeps a copy with the site (3.9), once the
  // person says yes.
  const { bundle } = actions;
  const url = finding.values?.url;
  if (rule === "externalResources" && bundle !== undefined && typeof url === "string") {
    return canBundle(finding)
      ? () => {
          void downloadAndBundle(actions.session, bundle, url);
        }
      : undefined;
  }
  return undefined;
}
