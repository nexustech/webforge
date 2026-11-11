import { settingValues } from "./bindings.js";
import { collectionItems, collectionOf, itemValues } from "./collections.js";
import { fileKey, keptAddressesOf, keptAddressWorks, pageFiles } from "./kept-addresses.js";
import { isImageMeta } from "./media.js";
import type { SiteSettings } from "./settings.js";
import { expandSharedCopies } from "./shared-sections.js";
import { pagePath, type SiteDoc } from "./site-doc.js";
import type {
  MediaItem,
  SiteCollection,
  SitePage,
  SiteRedirect,
  SiteSnapshot,
} from "./site-snapshot.js";

/**
 * The snapshot a build gets from the open site (export pipeline stage 1). Pages come in Pages panel
 * order; the "Page not found" page is never in navigation. `blobs` holds the original bytes of
 * images by hash: an image without bytes is left out, and the build reports it as missing only if a
 * page uses it.
 */
export function siteToSnapshot(
  site: SiteDoc,
  blobs: ReadonlyMap<string, Uint8Array>,
): SiteSnapshot {
  const pages = site.pageOrder.flatMap((id): SitePage[] => {
    const page = site.pages[id];
    if (page === undefined) {
      return [];
    }
    const {
      description,
      hideHeader,
      hideFooter,
      hideFromNavigation,
      hideBackToTop,
      hideFromSearch,
    } = page.settings;
    // Copies of shared sections are exported inline, as their shared section (F-ED-23).
    const content = expandSharedCopies(page.doc.content, site.sharedSections);
    // An item is drawn inside its collection's design, its elements showing the item's fields
    // (6.10a, ADR 0025, decision 5).
    const collection = collectionOf(site, page);
    const values = collection === undefined ? undefined : itemValues(collection, page);
    // A post shared shows its own picture, unless its Page Settings choose another.
    const picture = Object.values(values ?? {}).find((value) => value.kind === "image");
    const shareImage =
      page.settings.shareImage ??
      (picture?.kind === "image" ? picture.mediaId : undefined) ??
      site.settings.social.shareImage;
    return [
      {
        id: page.id,
        path: pagePath(page, site.homePageId),
        title: page.title,
        navLabel: page.navLabel,
        description: description ?? site.settings.general.description,
        // A post is in the menu only where the owner put it in an edited menu: a menu that follows
        // the pages leaves posts out (syncMenuWithPages, 6.10a).
        hideFromNavigation: hideFromNavigation || page.kind === "not-found",
        hideHeader,
        hideFooter,
        hideBackToTop,
        ...(hideFromSearch === true ? { hideFromSearch } : {}),
        ...(page.updated === undefined ? {} : { updated: page.updated }),
        ...(shareImage === undefined ? {} : { shareImage }),
        ...(values === undefined ? {} : { item: { values } }),
        doc: {
          ...page.doc,
          content:
            collection === undefined
              ? content
              : [...collection.design.before, ...content, ...collection.design.after],
        },
      },
    ];
  });

  const media = Object.values(site.media)
    .filter(isImageMeta)
    .flatMap((item): MediaItem[] => {
      const data = blobs.get(item.hash);
      return data === undefined
        ? []
        : [
            {
              id: item.id,
              name: item.name,
              mimeType: item.mimeType,
              data,
              alt: item.alt,
              ...(item.focal === undefined ? {} : { focal: item.focal }),
              ...(item.crop === undefined ? {} : { crop: item.crop }),
            },
          ];
    });

  return {
    name: site.settings.general.name,
    language: site.settings.general.language,
    theme: site.theme,
    layout: site.layout,
    pages,
    media,
    settings: settingValues(site.settings),
    openingHours: site.settings.contact.openingHours,
    socialProfiles: site.settings.social.profiles,
    ...businessOf(site),
    formService: site.settings.forms.service,
    backToTop: site.settings.general.backToTop,
    menu: site.menu,
    ...(site.settings.general.icon === undefined ? {} : { icon: site.settings.general.icon }),
    ...analyticsOf(site.settings.analytics),
    search: {
      allowIndexing: site.settings.search.allowIndexing,
      includeSitemap: site.settings.search.includeSitemap,
      readableByAi: site.settings.search.readableByAi ?? false,
      ...(site.settings.general.description === undefined
        ? {}
        : { description: site.settings.general.description }),
      ...(site.settings.social.xHandle === undefined
        ? {}
        : { xHandle: site.settings.social.xHandle }),
      ...(site.settings.search.verification === undefined
        ? {}
        : { verification: site.settings.search.verification }),
    },
    ...(hasCode(site.code) ? { code: site.code } : {}),
    ...collectionsOf(site),
    ...redirectsOf(site),
  };
}

/**
 * The site's collections with their items, newest first (6.10b), for the lists of posts, the
 * Blog's own pages and its feed. Only the items `site` has: a published site has no drafts.
 */
function collectionsOf(site: SiteDoc): { collections?: SiteCollection[] } {
  const collections = Object.values(site.collections).map(
    (collection): SiteCollection => ({
      id: collection.id,
      name: collection.name,
      folder: collection.folder,
      items: collectionItems(site, collection.id).map((page) => ({
        pageId: page.id,
        path: pagePath(page, site.homePageId),
        values: itemValues(collection, page),
      })),
    }),
  );
  return collections.length === 0 ? {} : { collections };
}

/** Site Settings' Google Analytics for the export (3.8): nothing without a Measurement ID. */
function analyticsOf(analytics: SiteSettings["analytics"]): Pick<SiteSnapshot, "analytics"> {
  const { measurementId, consentBanner, consentMessage } = analytics;
  if (measurementId === undefined) return {};
  return {
    analytics: {
      measurementId,
      consentBanner,
      ...(consentMessage === undefined ? {} : { consentMessage }),
    },
  };
}

/**
 * The old addresses `site` keeps working (#862) for the export: those that still work, each going
 * to its page's path now, once per file in any case (the later stays, as Site Settings' list
 * keeps it). None when there are none.
 */
function redirectsOf(site: SiteDoc): { redirects?: SiteRedirect[] } {
  const files = pageFiles(site);
  const byFile = new Map<string, SiteRedirect>();
  for (const kept of keptAddressesOf(site)) {
    const page = site.pages[kept.page];
    if (page === undefined || !keptAddressWorks(site, kept, files)) continue;
    byFile.delete(fileKey(kept.from));
    byFile.set(fileKey(kept.from), { from: kept.from, to: pagePath(page, site.homePageId) });
  }
  return byFile.size === 0 ? {} : { redirects: [...byFile.values()] };
}

/** Whether `code` has any code of its own: the bundled files only serve it. */
const hasCode = ({ css, js, head, bodyEnd }: SiteDoc["code"]) =>
  [css, js, head, bodyEnd].some((code) => code.trim() !== "");

/** The site's business details for its structured data (3.15, SEO-1), when it has any. */
function businessOf(site: SiteDoc): { business?: NonNullable<SiteSnapshot["business"]> } {
  const { businessType, businessKind } = site.settings.general;
  const { priceRange, geo } = site.settings.contact;
  const business = {
    ...(businessType === undefined ? {} : { type: businessType }),
    ...(businessKind === undefined ? {} : { kind: businessKind }),
    ...(priceRange === undefined || priceRange.trim() === ""
      ? {}
      : { priceRange: priceRange.trim() }),
    ...(geo === undefined ? {} : { geo }),
  };
  return Object.keys(business).length === 0 ? {} : { business };
}
