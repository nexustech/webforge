import {
  expandSharedCopies,
  type FileMeta,
  type ImageMeta,
  isImageMeta,
  menuFileLinks,
  type SiteDoc,
  type SiteSnapshot,
  siteToSnapshot,
} from "@webforge/model";
import type { ComponentLibrary } from "./library.js";
import { documentsLinkedBy, mediaUsedBy } from "./render-static.js";

/**
 * What a build of a site needs besides its documents (ADR 0018 §3): its snapshot, and the images
 * its pages, Header and Footer use and the documents they link to, by hash, without their bytes.
 * The build asks for each one's bytes from the site's file as it reaches it (R15).
 */
export type SiteContent = {
  readonly snapshot: SiteSnapshot;
  readonly media: Pick<ImageMeta, "id" | "name" | "mimeType" | "hash" | "alt" | "focal" | "crop">[];
  readonly documents: Pick<FileMeta, "id" | "name" | "mimeType" | "hash">[];
};

/**
 * What a build of `site` needs (an export's, the preview's, a publish's): its snapshot, and the
 * images and documents it uses, by hash. The renderer sends it for the open site; the export
 * worker makes it for a site main read from the file, to publish (ADR 0018 §3). No React, DOM or
 * Node: `library`'s field kinds say where images and links are.
 */
export function siteContentFor(site: SiteDoc, library: ComponentLibrary): SiteContent {
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
  };
}

/**
 * The snapshot a build of `site` starts from (ADR 0018 §3): {@link siteContentFor}'s, its images
 * and documents named by hash, the build asking for each one's bytes as it reaches it (R15). The
 * export worker builds a site main read from the file with it, to publish.
 */
export function siteSnapshotFor(site: SiteDoc, library: ComponentLibrary): SiteSnapshot {
  const content = siteContentFor(site, library);
  return { ...content.snapshot, media: content.media, documents: content.documents };
}
