import {
  exportedAddress,
  exportedSiteAddress,
  exportedTitle,
  type ImageMeta,
  isImageMeta,
  type MediaId,
  type PageEntry,
  pagePath,
  type SiteDoc,
  slugify,
} from "@webforge/model";
import { MEDIA_SCHEME } from "../../shared/ipc/media.js";

/** What Page Settings has typed that the preview shows (3.16). */
export type PreviewValues = {
  readonly title: string;
  readonly slug: string;
  readonly description: string;
  readonly shareImage: MediaId | undefined;
  readonly hideFromSearch: boolean;
};

/**
 * A page as the export will show it in a search result and when shared (3.16, SEO-6): the same
 * title, address and description it writes (`exportedTitle`, `exportedAddress`), from the values
 * as typed.
 */
export type PagePreview = {
  /** Its `<title>` and `og:title`. */
  readonly title: string;
  /** Its address under the web address, or its file without one. */
  readonly address: string;
  /** The web address's host, for the share card; none without a web address. */
  readonly host: string | undefined;
  /** Its description, or the site's when it has none (`inherited`); none if neither has one. */
  readonly description: string | undefined;
  readonly inherited: boolean;
  /** Why it isn't in search results, if it isn't: hidden itself, the site hidden, or "Page not found". */
  readonly hidden: "page" | "site" | "not-found" | undefined;
  /** Its share picture's thumbnail, the site's when it has none; none if neither has one. */
  readonly image: string | undefined;
};

/** A Media image's thumbnail, as the app serves it. */
export const thumbnailUrl = (image: ImageMeta) => `${MEDIA_SCHEME}://thumbnail/${image.hash}`;

/**
 * What the export will show of `page` in Page Settings' preview, from `values` as typed; images
 * by `imageUrl` (stories draw their own).
 */
export function pagePreview(
  site: SiteDoc,
  page: PageEntry,
  values: PreviewValues,
  imageUrl: (image: ImageMeta) => string = thumbnailUrl,
): PagePreview {
  const slug = values.slug.trim() === "" ? page.slug : slugify(values.slug);
  // An emptied title keeps the saved one, as saving does.
  const title = values.title.trim() === "" ? page.title : values.title.trim();
  const path = pagePath({ ...page, slug }, site.homePageId);
  const web = exportedSiteAddress(site.settings.address.url);
  const own = values.description.trim();
  const siteDescription = site.settings.general.description?.trim() ?? "";
  const imageId = values.shareImage ?? site.settings.social.shareImage;
  const image = imageId === undefined ? undefined : site.media[imageId];
  return {
    title: exportedTitle(site.settings.general.name, path, title),
    address: web === undefined ? `${path}.html` : exportedAddress(web, path),
    host: web === undefined ? undefined : new URL(web).host,
    description: own !== "" ? own : siteDescription !== "" ? siteDescription : undefined,
    inherited: own === "" && siteDescription !== "",
    hidden:
      page.kind === "not-found"
        ? "not-found"
        : values.hideFromSearch
          ? "page"
          : site.settings.search.allowIndexing
            ? undefined
            : "site",
    image: image !== undefined && isImageMeta(image) ? imageUrl(image) : undefined,
  };
}
