import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_THEME } from "@webforge/model";
import type { ProjectStore } from "@webforge/storage";
import { siteFromTemplate } from "@webforge/templates";
import type { TemplateFolder } from "@webforge/templates/node";
import { themePreset } from "@webforge/themes";
import type { NewSiteRequest } from "../shared/ipc/project.js";
import { starterSite } from "../shared/starter-site.js";

/**
 * Writes the site New Site asked for into a new site's store (2.14a, F-SITE-1): the template's
 * pages, Header and Footer, menu and settings, with its images as Media assets, or the Blank site
 * without one. Named as typed, in the chosen theme preset (the default theme for a preset this
 * build doesn't have). Main does it, since the images go into the site file.
 */
export function fillNewSite(
  store: Pick<ProjectStore, "putAsset" | "saveSite">,
  request: NewSiteRequest,
  templates: () => readonly TemplateFolder[],
): void {
  const theme = themePreset(request.theme) ?? DEFAULT_THEME;
  if (request.template === undefined) {
    store.saveSite(starterSite({ name: request.name, theme }));
    return;
  }
  const folder = templates().find((each) => each.template.id === request.template);
  if (folder === undefined) {
    throw new Error(`No template ${request.template}`);
  }
  for (const image of folder.images) {
    store.putAsset({
      mediaId: image.mediaId,
      data: readFileSync(join(folder.imagesDir, image.file)),
      mime: image.mimeType,
      width: image.width,
      height: image.height,
      originalName: image.file,
    });
  }
  store.saveSite(siteFromTemplate(folder.template, folder.images, { name: request.name, theme }));
}
