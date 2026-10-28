import { settingValues } from "./bindings.js";
import { isImageMeta } from "./media.js";
import type { SiteSettings } from "./settings.js";
import { expandSharedCopies } from "./shared-sections.js";
import { pagePath, type SiteDoc } from "./site-doc.js";
import type { MediaItem, SitePage, SiteSnapshot } from "./site-snapshot.js";

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
    const { description, hideHeader, hideFooter, hideFromNavigation, hideBackToTop } =
      page.settings;
    const shareImage = page.settings.shareImage ?? site.settings.social.shareImage;
    return [
      {
        id: page.id,
        path: pagePath(page, site.homePageId),
        title: page.title,
        navLabel: page.navLabel,
        description: description ?? site.settings.general.description,
        hideFromNavigation: hideFromNavigation || page.kind === "not-found",
        hideHeader,
        hideFooter,
        hideBackToTop,
        ...(shareImage === undefined ? {} : { shareImage }),
        // Copies of shared sections are exported inline, as their shared section (F-ED-23).
        doc: { ...page.doc, content: expandSharedCopies(page.doc.content, site.sharedSections) },
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
    },
  };
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
