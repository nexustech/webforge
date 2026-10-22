import { isImageMeta, type SiteDoc, siteToSnapshot } from "@webforge/model";
import { type ComponentLibrary, documentsLinkedBy, mediaUsedBy } from "@webforge/site-components";
import type { ExportRequest } from "../../shared/ipc/site.js";

/**
 * What the export command sends for `site`: its snapshot, and the images its pages, Header and
 * Footer use and the documents they link to, by hash. The main process reads only those files'
 * bytes from the site file.
 */
export function exportRequestFor(site: SiteDoc, library: ComponentLibrary): ExportRequest {
  const nodes = [
    ...site.layout.header,
    ...site.layout.footer,
    ...site.pageOrder.flatMap((id) => site.pages[id]?.doc.content ?? []),
  ];
  const used = mediaUsedBy(nodes, library);
  const linked = documentsLinkedBy(nodes, library);
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
    documents: Object.values(site.media).flatMap((item) =>
      item.kind === "file" && linked.has(item.id)
        ? [{ id: item.id, name: item.name, mimeType: item.mimeType, hash: item.hash }]
        : [],
    ),
  };
}
