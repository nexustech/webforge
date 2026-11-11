import {
  collectionPictures,
  type FileMeta,
  type ImageMeta,
  isImageMeta,
  itemPicturesShown,
  menuFileLinks,
  previewedSite,
  publishedSite,
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
 * Node: `library`'s field kinds say where images and links are. Draft pages are left out (G37,
 * #864), with the pictures and documents only they use, unless `drafts` asks for them, as Preview
 * does: then each is at its address and out of the navigation, as the menu is published.
 */
export function siteContentFor(
  site: SiteDoc,
  library: ComponentLibrary,
  { drafts = false }: { readonly drafts?: boolean } = {},
): SiteContent {
  return contentOf(drafts ? previewedSite(site) : publishedSite(site), library);
}

/** {@link siteContentFor} of a site as it is published. */
function contentOf(site: SiteDoc, library: ComponentLibrary): SiteContent {
  const snapshot = siteToSnapshot(site, new Map());
  const nodes = [
    ...site.layout.header,
    ...site.layout.footer,
    // Pages as the export shows them: copies of shared sections as their section (F-ED-23), a
    // post inside its Blog's design (6.10a). Their images and documents are the pages' too.
    ...snapshot.pages.flatMap((page) => page.doc.content),
  ];
  const used = mediaUsedBy(nodes, library);
  // The favicon set's source and the share pictures (3.4), from Site Settings and Page Settings,
  // and the pictures of posts their design shows (6.10a).
  for (const id of [
    site.settings.general.icon,
    site.settings.social.shareImage,
    ...snapshot.pages.map((page) => page.shareImage),
    ...snapshot.pages.flatMap(itemPicturesShown),
    // Every published post's picture: Latest posts' cards show it (6.10b).
    ...collectionPictures(snapshot.collections),
  ]) {
    if (id !== undefined) used.add(id);
  }
  // Documents elements link to, and those the navigation menu links to.
  const linked = documentsLinkedBy(nodes, library);
  for (const id of menuFileLinks(site.menu)) linked.add(id);
  return {
    snapshot,
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
