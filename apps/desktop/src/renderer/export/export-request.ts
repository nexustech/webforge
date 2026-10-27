import {
  expandSharedCopies,
  isImageMeta,
  menuFileLinks,
  type SiteDoc,
  siteToSnapshot,
} from "@webforge/model";
import { type ComponentLibrary, documentsLinkedBy, mediaUsedBy } from "@webforge/site-components";
import type { ExportChoices, ExportRequest } from "../../shared/ipc/site.js";

/**
 * What the export command sends for `site`: its snapshot, and the images its pages, Header and
 * Footer use and the documents they link to, by hash. The main process reads only those files'
 * bytes from the site file. `choices` are the person's, to remember with the site, and `output`
 * what this export writes (3.3).
 */
export function exportRequestFor(
  site: SiteDoc,
  library: ComponentLibrary,
  choices: ExportChoices,
  output: ExportRequest["output"],
): ExportRequest {
  const nodes = [
    ...site.layout.header,
    ...site.layout.footer,
    // Copies of shared sections as the export shows them (F-ED-23): their images and documents
    // are the pages' too.
    ...site.pageOrder.flatMap((id) =>
      expandSharedCopies(site.pages[id]?.doc.content ?? [], site.sharedSections),
    ),
  ];
  const used = mediaUsedBy(nodes, library);
  // The favicon set's source and the share pictures (3.4), from Site Settings and Page Settings.
  for (const id of [
    site.settings.general.icon,
    site.settings.social.shareImage,
    ...Object.values(site.pages).map((page) => page.settings.shareImage),
  ]) {
    if (id !== undefined) used.add(id);
  }
  // Documents elements link to, and those the navigation menu links to.
  const linked = documentsLinkedBy(nodes, library);
  for (const id of menuFileLinks(site.menu)) linked.add(id);
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
    choices,
    output,
  };
}
