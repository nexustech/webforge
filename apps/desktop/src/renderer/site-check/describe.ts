import { t } from "@webforge/i18n";
import {
  type ColorRole,
  type ElementPlace,
  type MenuItem,
  type NodeDoc,
  type PageId,
  pagePath,
  type SharedSectionId,
  type SiteDoc,
} from "@webforge/model";
import type { Finding } from "@webforge/site-check";
import type { ComponentLibrary } from "@webforge/site-components";
import { elementName } from "../editor/labels.js";
import { ROLE_NAMES } from "../theme/index.js";

/** `"header"` or `"footer"` when that is where `on` is. */
const layoutRegion = (on: ElementPlace): "header" | "footer" | undefined =>
  on === "header" ? "header" : on === "footer" ? "footer" : undefined;

/** The element `nodeId` kept `on`, at any depth, if it's there. */
function findNode(site: SiteDoc, on: ElementPlace, nodeId: string): NodeDoc | undefined {
  const region = layoutRegion(on);
  const shared = site.sharedSections[on as SharedSectionId]?.section;
  const roots: readonly NodeDoc[] =
    region !== undefined
      ? site.layout[region]
      : (site.pages[on as PageId]?.doc.content ?? (shared === undefined ? [] : [shared]));
  const search = (nodes: readonly unknown[]): NodeDoc | undefined => {
    for (const node of nodes) {
      if (typeof node !== "object" || node === null) continue;
      const each = node as NodeDoc;
      if (each.props.id === nodeId) return each;
      for (const value of Object.values(each.props)) {
        if (!Array.isArray(value)) continue;
        const found = search(value);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  };
  return search(roots);
}

/** A page as Site Check names it: its title, or its file while it has none. */
function pageName(site: SiteDoc, pageId: string): string {
  const page = site.pages[pageId as keyof SiteDoc["pages"]];
  if (page === undefined) return pageId;
  return page.title.trim() === ""
    ? t("siteCheck.place.untitled", { file: `${pagePath(page, site.homePageId)}.html` })
    : page.title;
}

/** The menu item `id`, dropdowns' items included. */
function menuItem(site: SiteDoc, id: string): MenuItem | undefined {
  return site.menu.items
    .flatMap((item) => (item.kind === "group" ? [item, ...item.children] : [item]))
    .find((item) => item.id === id);
}

/** A theme colour's name, as Theme Studio has it. */
const colourName = (role: unknown) =>
  typeof role === "string" && Object.hasOwn(ROLE_NAMES, role)
    ? t(ROLE_NAMES[role as ColorRole])
    : String(role);

/** Where `finding` is, in a few words: "Heading on About", "Menu item Prices", "photo.jpg". */
export function describePlace(finding: Finding, site: SiteDoc, library: ComponentLibrary): string {
  const { place, values = {} } = finding;
  switch (place.kind) {
    case "element": {
      const node = findNode(site, place.on, place.nodeId);
      const element =
        node === undefined ? place.nodeId : elementName(node, library, site.sharedSections);
      const region = layoutRegion(place.on);
      if (region !== undefined) return t(`siteCheck.place.${region}`, { element });
      if (Object.hasOwn(site.pages, place.on)) {
        return t("siteCheck.place.page", { element, page: pageName(site, place.on) });
      }
      const shared = site.sharedSections[place.on as keyof SiteDoc["sharedSections"]];
      return t("siteCheck.place.shared", { element, name: shared?.name ?? place.on });
    }
    case "menu": {
      const item = menuItem(site, place.itemId);
      const label =
        item === undefined
          ? place.itemId
          : item.kind === "page"
            ? (item.label ?? pageName(site, item.pageId))
            : item.label;
      return t("siteCheck.place.menu", { name: label });
    }
    case "page":
      return pageName(site, place.pageId);
    case "media":
      return String(values.name ?? site.media[place.mediaId]?.fileName ?? place.mediaId);
    case "theme":
      return t(
        String(values.palette) === "inverse" ? "siteCheck.place.reversed" : "siteCheck.place.theme",
        { foreground: colourName(values.foreground), background: colourName(values.background) },
      );
    case "address":
      return t("siteCheck.place.address");
  }
}

/** `bytes` in MB, as the Media panel writes sizes. */
const megabytes = (bytes: number) =>
  new Intl.NumberFormat(undefined, {
    style: "unit",
    unit: "megabyte",
    maximumFractionDigits: 1,
  }).format(bytes / 1_000_000);

/** What else the panel says of `finding`: a ratio, a size; `undefined` when nothing. */
export function describeDetail(finding: Finding): string | undefined {
  const { values } = finding;
  if (values === undefined) return undefined;
  if (values.ratio !== undefined && values.required !== undefined) {
    return t("siteCheck.detail.contrast", { ratio: values.ratio, required: values.required });
  }
  if (values.width !== undefined && values.height !== undefined) {
    return t("siteCheck.detail.size", { width: values.width, height: values.height });
  }
  if (typeof values.bytes === "number") return megabytes(values.bytes);
  return undefined;
}
