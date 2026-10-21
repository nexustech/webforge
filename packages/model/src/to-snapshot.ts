import { settingValues } from "./bindings.js";
import { isImageMeta } from "./media.js";
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
    const { description, hideHeader, hideFooter, hideFromNavigation } = page.settings;
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
        doc: page.doc,
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
  };
}
