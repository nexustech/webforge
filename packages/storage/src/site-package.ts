import {
  exportChoicesSchema,
  type SiteDoc,
  siteCheckIgnoredSchema,
  siteDocuments,
} from "@webforge/model";
import { z } from "zod";
import { reachableBlobs } from "./blob-reach.js";
import type { NewAsset, ProjectStore, StoredBlob } from "./project-store.js";

// A site package (A26): one site with everything it needs to open as a new site, and the one shape
// a site's ZIP (4.7) and opening a version as a new site (4.6) share. A ZIP writes it out, with the
// versions besides; docs/site-zip.md documents the layout.

/**
 * What a project keeps beside its site that a package carries: the person's choices for the site,
 * which a lossless round trip keeps. Design or Content mode, the last export's choices and what
 * Site Check ignores.
 *
 * Not carried, so a package always opens as a new site: the project's id and creation time (the
 * new file has its own, so publishing tells the copy from the original, A8), its storage format,
 * its backups, its publish destinations (ADR 0018 §2: a copy adds its own, so it can't publish over
 * the original's folder unasked), and its saved publish passwords and code trust, which the app
 * keeps in its own data under the project id (security review S1 and S2).
 */
export const sitePackageProjectSchema = z.strictObject({
  editorMode: z.enum(["design", "content"]),
  exportChoices: exportChoicesSchema,
  siteCheckIgnored: siteCheckIgnoredSchema,
});

/** See {@link sitePackageProjectSchema}. */
export type SitePackageProject = z.infer<typeof sitePackageProjectSchema>;

/** A blob a package carries, with the SHA-256 it is stored under. */
type Hashed<T> = T & { readonly hash: string };

/** One site, ready to fill a new project with. */
export type SitePackage = {
  /** The site, migrated to this app's format. */
  readonly site: SiteDoc;
  /** The original of each Media item the site reaches, with its name and dimensions. */
  readonly media: readonly Hashed<NewAsset>[];
  /** Other files the site names by their SHA-256, such as bundled code (3.9). */
  readonly files: readonly Hashed<StoredBlob>[];
  readonly project: SitePackageProject;
};

/** What `store` keeps beside its site that a package carries. */
export function packageProject(store: ProjectStore): SitePackageProject {
  return {
    editorMode: store.readEditorMode(),
    exportChoices: store.readExportChoices(),
    siteCheckIgnored: store.readSiteCheckIgnored(),
  };
}

/**
 * The Media originals and other files in `store` that `sites` reach, as garbage collection keeps
 * them: an asset or file none of them names isn't carried. A blob that has gone is left out.
 */
export function packageBlobs(
  store: ProjectStore,
  sites: readonly SiteDoc[],
): Pick<SitePackage, "media" | "files"> {
  const reached = reachableBlobs(sites.flatMap(siteDocuments));
  // Two Media items can share an original (the same file imported twice): each is carried.
  const assets = store.listAssets().filter((asset) => reached.has(asset.hash));
  const originals = new Set(assets.map((asset) => asset.hash));
  const media = assets.flatMap((asset): Hashed<NewAsset>[] => {
    const blob = store.readBlob(asset.hash);
    return blob === undefined
      ? []
      : [
          {
            mediaId: asset.mediaId,
            data: blob.data,
            mime: asset.mime,
            width: asset.width,
            height: asset.height,
            originalName: asset.originalName,
            hash: asset.hash,
          },
        ];
  });
  const files = [...reached]
    .filter((hash) => !originals.has(hash))
    .sort()
    .flatMap((hash) => {
      const blob = store.readBlob(hash);
      return blob === undefined ? [] : [{ ...blob, hash }];
    });
  return { media, files };
}

/** `site` as `store` holds it, with what it reaches, as a package (4.6 opens a version so). */
export function sitePackageOf(store: ProjectStore, site: SiteDoc): SitePackage {
  return { site, ...packageBlobs(store, [site]), project: packageProject(store) };
}

/**
 * Fills `store`, a new, empty project, with `pack`: its files and Media first, then the site that
 * names them, then the project's choices. Run as a new site's fill, before the site opens.
 */
export function fillFromSitePackage(store: ProjectStore, pack: SitePackage): void {
  for (const file of pack.files) store.putBlob(file.data, file.mime);
  for (const item of pack.media) store.putAsset(item);
  store.saveSite(pack.site);
  store.writeEditorMode(pack.project.editorMode);
  store.writeExportChoices(pack.project.exportChoices);
  store.writeSiteCheckIgnored(pack.project.siteCheckIgnored);
}
