import { t } from "@webforge/i18n/components";
import type { ColorRole, MenuItem, SiteDoc } from "@webforge/model";
import type { Finding } from "@webforge/site-check";
import type { ComponentLibrary } from "@webforge/site-components";
import { elementPlaceName, ON_PAGE, pageName } from "../editor/element-place.js";
import { colourRefName } from "../fields/index.js";
import { ROLE_NAMES } from "../theme/index.js";

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

/**
 * Where `finding` is, in a few words: "Heading on About", "Menu item Prices", "photo.jpg".
 * `onPage` words an element on a page, for a caller with words of its own (the code trust prompt).
 */
export function describePlace(
  finding: Finding,
  site: SiteDoc,
  library: ComponentLibrary,
  onPage: (element: string, page: string) => string = ON_PAGE,
): string {
  const { place, values = {} } = finding;
  switch (place.kind) {
    case "element":
      return elementPlaceName(site, library, place.on, place.nodeId, onPage);
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
    case "pages":
      return t("siteCheck.place.pages");
    case "media":
      return String(values.name ?? site.media[place.mediaId]?.fileName ?? place.mediaId);
    case "theme":
      // In the Theme tab's words (#1174): "Brand is hard to read on Third surface".
      return t(
        String(values.palette) === "inverse"
          ? "siteCheck.place.reversed"
          : "theme.contrast.hardToRead",
        { foreground: colourName(values.foreground), background: colourName(values.background) },
      );
    case "address":
      return t("siteCheck.place.address");
    case "code":
      return t(`siteCheck.place.code.${place.part}`);
    case "contact":
      return t(`siteCheck.place.contact.${place.field}`);
    case "search":
      return t("siteCheck.place.search");
    case "guide":
      return t(`siteCheck.place.guide.${place.guide}`);
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
    const measured = { ratio: values.ratio, required: values.required };
    if (values.drawn === "graphic") return t("siteCheck.detail.contrastGraphic", measured);
    // On a gradient (CT-13), with a theme text colour that reads on both ends if one does.
    if (values.on === "gradient") {
      return typeof values.suggested === "string"
        ? t("siteCheck.detail.contrastGradientSuggested", {
            ...measured,
            colour: colourRefName(values.suggested),
          })
        : t("siteCheck.detail.contrastGradient", measured);
    }
    return t("siteCheck.detail.contrast", measured);
  }
  if (values.width !== undefined && values.height !== undefined) {
    return t("siteCheck.detail.size", { width: values.width, height: values.height });
  }
  if (typeof values.bytes === "number") return megabytes(values.bytes);
  // The address of a file from another website (3.9), as the code has it. An http:// one can't be
  // allowed, as Settings take https:// addresses only, so it says what to do instead.
  if (typeof values.url === "string") {
    return /^http:\/\//i.test(values.url)
      ? t("siteCheck.detail.insecure", { url: values.url })
      : values.url;
  }
  // Being found (3.17): a page's main headings, and the page whose title or description it shares.
  if (typeof values.headings === "number") {
    return values.headings === 0
      ? t("siteCheck.detail.noHeading")
      : t("siteCheck.detail.headings", { count: values.headings });
  }
  if (typeof values.sameAs === "string")
    return t("siteCheck.detail.sameAs", { file: values.sameAs });
  // A rule of the site's own stylesheet that matches nothing (6.8), by its selector.
  if (typeof values.selector === "string") {
    return t("siteCheck.detail.selector", { selector: values.selector });
  }
  // The draft page a link goes to (G37, #864), by its title.
  if (typeof values.draftPage === "string") {
    return t("siteCheck.detail.draftPage", { page: values.draftPage });
  }
  // The first detail of a text marked as an example (#1228, WN-3), as written there.
  if (typeof values.example === "string") {
    return t("siteCheck.detail.example", { detail: values.example });
  }
  // A note on an element (UX-17), as the person wrote it.
  if (typeof values.note === "string") return values.note;
  // The year a published site shows (F-CM-8), as it was published.
  if (typeof values.publishedYear === "number") {
    return t("siteCheck.detail.publishedYear", { year: String(values.publishedYear) });
  }
  return undefined;
}
