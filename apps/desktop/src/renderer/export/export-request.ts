import { isImageMeta, type SiteDoc, siteToSnapshot } from "@webforge/model";
import { type ComponentLibrary, mediaUsedBy } from "@webforge/site-components";
import type { ExportRequest } from "../../shared/ipc/site.js";

/**
 * What the export command sends for `site`: its snapshot, and the images its pages, Header and
 * Footer use, by hash. The main process reads only those images' bytes from the site file.
 */
export function exportRequestFor(site: SiteDoc, library: ComponentLibrary): ExportRequest {
  const used = mediaUsedBy(
    [
      ...site.layout.header,
      ...site.layout.footer,
      ...site.pageOrder.flatMap((id) => site.pages[id]?.doc.content ?? []),
    ],
    library,
  );
  return {
    snapshot: siteToSnapshot(site, new Map()),
    media: Object.values(site.media)
      .filter(isImageMeta)
      .filter((image) => used.has(image.id))
      .map((image) => ({
        id: image.id,
        name: image.name,
        mimeType: image.mimeType,
        hash: image.hash,
        alt: image.alt,
        ...(image.focal === undefined ? {} : { focal: image.focal }),
        ...(image.crop === undefined ? {} : { crop: image.crop }),
      })),
  };
}
