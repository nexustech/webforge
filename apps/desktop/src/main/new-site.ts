import { join } from "node:path";
import { DEFAULT_THEME } from "@webforge/model";
import { siteFromTemplate } from "@webforge/templates";
import type { TemplateFolder } from "@webforge/templates/node";
import { themePreset } from "@webforge/themes";
import type { NewSiteRequest } from "../shared/ipc/project.js";
import { starterSite } from "../shared/starter-site.js";
import type { NewSiteTarget } from "./project-session.js";

/**
 * Writes the site New Site asked for into a new site's file (2.14a, F-SITE-1): the template's
 * pages, Header and Footer, menu and settings, with its images as Media assets, or the Blank site
 * without one. Named as typed, in the chosen theme preset (the default theme for a preset this
 * build doesn't have). Main does it, since the images go into the site file.
 *
 * The images go through the storage writer, off the main thread as imports do (R13b), and each
 * must be stored under the hash its manifest gives, which the site's Media items name: a shipped
 * file that differs (re-encoded, or a stale copy) fails the site clearly instead of making one
 * whose photos are missing.
 */
export async function fillNewSite(
  target: Pick<NewSiteTarget, "importFile"> & {
    readonly store: Pick<NewSiteTarget["store"], "saveSite">;
  },
  request: NewSiteRequest,
  templates: () => readonly TemplateFolder[],
): Promise<void> {
  const theme = themePreset(request.theme) ?? DEFAULT_THEME;
  if (request.template === undefined) {
    target.store.saveSite(starterSite({ name: request.name, theme }));
    return;
  }
  const folder = templates().find((each) => each.template.id === request.template);
  if (folder === undefined) {
    throw new Error(`No template ${request.template}`);
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
