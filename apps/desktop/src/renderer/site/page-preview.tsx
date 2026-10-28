import { t } from "@webforge/i18n";
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
import type { ReactNode } from "react";
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
  const path = pagePath({ ...page, slug }, site.homePageId);
  const web = exportedSiteAddress(site.settings.address.url);
  const own = values.description.trim();
  const siteDescription = site.settings.general.description?.trim() ?? "";
  const imageId = values.shareImage ?? site.settings.social.shareImage;
  const image = imageId === undefined ? undefined : site.media[imageId];
  return {
    title: exportedTitle(site.settings.general.name, path, values.title.trim()),
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

/** A heading over one of the cards, and its hint under it. */
function Preview({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly children: ReactNode;
}) {
  return (
    <section aria-label={label} className="grid gap-1">
      <h3 className="m-0 text-xs text-muted-foreground">{label}</h3>
      {children}
      {hint === undefined ? null : <p className="m-0 text-xs text-muted-foreground">{hint}</p>}
    </section>
  );
}

/**
 * The page as a search result on a phone (3.16, SEO-6): its address, title and description, cut
 * where a phone's result cuts them. Soft guidance: no counter and no limit, as Google documents
 * none; it says so in its hint. A page kept from search says so instead.
 */
export function SearchResultCard({ preview }: { readonly preview: PagePreview }) {
  if (preview.hidden !== undefined) {
    return (
      <Preview label={t("pageSettings.preview.search")}>
        <p className="m-0 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          {t(`pageSettings.preview.hidden.${preview.hidden}`)}
        </p>
      </Preview>
    );
  }
  return (
    <Preview
      label={t("pageSettings.preview.search")}
      hint={
        preview.inherited
          ? `${t("pageSettings.preview.inherited")} ${t("pageSettings.preview.hint")}`
          : t("pageSettings.preview.hint")
      }
    >
      <div className="grid w-full max-w-[22rem] gap-0.5 rounded-md border border-border bg-card p-3">
        <p className="m-0 truncate text-xs text-muted-foreground">{preview.address}</p>
        <p className="m-0 line-clamp-2 text-base leading-snug text-primary [overflow-wrap:anywhere]">
          {preview.title}
        </p>
        {preview.description === undefined ? (
          <p className="m-0 text-sm text-muted-foreground italic">
            {t("pageSettings.preview.noDescription")}
          </p>
        ) : (
          <p className="m-0 line-clamp-3 text-sm text-card-foreground [overflow-wrap:anywhere]">
            {preview.description}
          </p>
        )}
      </div>
    </Preview>
  );
}

/**
 * The page as a link preview when it's shared (3.16, G22): its share picture (the site's when it
 * has none), the web address's host, and the Open Graph title and description the export writes.
 */
export function ShareCard({ preview }: { readonly preview: PagePreview }) {
  return (
    <Preview
      label={t("pageSettings.preview.share")}
      {...(preview.host === undefined ? { hint: t("pageSettings.preview.noAddress") } : {})}
    >
      <div className="grid w-full max-w-[22rem] overflow-hidden rounded-md border border-border bg-card">
        {preview.image === undefined ? (
          <div className="flex aspect-[1.91/1] items-center justify-center bg-muted text-xs text-muted-foreground">
            {t("pageSettings.preview.noImage")}
          </div>
        ) : (
          <img src={preview.image} alt="" className="aspect-[1.91/1] w-full object-cover" />
        )}
        <div className="grid gap-0.5 p-3">
          {preview.host === undefined ? null : (
            <p className="m-0 truncate text-xs text-muted-foreground uppercase">{preview.host}</p>
          )}
          <p className="m-0 line-clamp-2 text-sm font-semibold text-card-foreground [overflow-wrap:anywhere]">
            {preview.title}
          </p>
          {preview.description === undefined ? null : (
            <p className="m-0 line-clamp-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">
              {preview.description}
            </p>
          )}
        </div>
      </div>
    </Preview>
  );
}
