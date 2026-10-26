import { join } from "node:path";
import { DEFAULT_THEME } from "@webforge/model";
import type { ProjectStore } from "@webforge/storage";
import { BLANK_TEMPLATE_ID, siteFromTemplate } from "@webforge/templates";
import type { TemplateFolder } from "@webforge/templates/node";
import { themePreset } from "@webforge/themes";
import type { NewSiteRequest } from "../shared/ipc/project.js";
import type { StorageWriter } from "./storage-writer.js";

/** What New Site makes of a new site (2.14a): its name, and what writes its content. */
export type NewSiteFill = {
  readonly name: string;
  readonly fill: (target: NewSiteTarget) => Promise<void>;
};

/** What came of putting a file into the new site: stored under `hash`, or not. */
type NewSiteImport =
  | { readonly status: "stored"; readonly hash: string }
  | { readonly status: "rejected" | "skipped" | "failed" };

/** The new site's file as New Site fills it, before it opens (2.14a). */
export type NewSiteTarget = {
  readonly store: ProjectStore;
  /** Stores the file at `path` as Media item `mediaId`'s asset in the new file. */
  readonly importFile: (mediaId: string, fileName: string, path: string) => Promise<NewSiteImport>;
};

/**
 * How New Site puts a file into the new site's file at `sitePath`: through the storage writer, off
 * the main thread as imports are (R13b). No gate: the file isn't the open site's yet.
 */
export function newSiteImporter(
  writer: Pick<StorageWriter, "prepare" | "store">,
  sitePath: string,
): NewSiteTarget["importFile"] {
  return async (mediaId, fileName, path) => {
    const prepared = await writer.prepare(fileName, { path });
    if (prepared.status !== "prepared") return { status: prepared.status };
    const stored = await writer.store(prepared, { sitePath, mediaId, originalName: fileName });
    return stored.status === "stored"
      ? { status: "stored", hash: prepared.hash }
      : { status: "failed" };
  };
}

/**
 * Writes the site New Site asked for into a new site's file (2.14a, F-SITE-1): the template's
 * pages, Header and Footer, menu and settings, with its images as Media assets, or the Blank
 * template's without one (2.15c). Named as typed, in the chosen theme preset (the default theme
 * for a preset this build doesn't have). Main does it, since the images go into the site file.
 *
 * The images go through the storage writer, off the main thread as imports do (R13b), and each
 * must be stored under the hash its manifest gives, which the site's Media items name: a shipped
 * file that differs (re-encoded, or a stale copy) fails the site clearly instead of making one
 * whose photos are missing.
 */
export async function fillNewSite(
  target: NewSiteTarget,
  request: NewSiteRequest,
  templates: () => readonly TemplateFolder[],
): Promise<void> {
  const theme = themePreset(request.theme) ?? DEFAULT_THEME;
  const id = request.template ?? BLANK_TEMPLATE_ID;
  const folder = templates().find((each) => each.template.id === id);
  if (folder === undefined) {
    throw new Error(`No template ${id}`);
  }
  for (const image of folder.images) {
    const outcome = await target.importFile(
      image.mediaId,
      image.file,
      join(folder.imagesDir, image.file),
    );
    if (outcome.status !== "stored" || outcome.hash !== image.hash) {
      throw new Error(
        `Template ${folder.template.id}'s image ${image.file} isn't as its manifest says (${outcome.status})`,
      );
    }
  }
  target.store.saveSite(
    siteFromTemplate(folder.template, folder.images, { name: request.name, theme }),
  );
}
