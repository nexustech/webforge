import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { siteToSnapshot } from "@webforge/model";
import { buildSite } from "@webforge/pipeline";
import { loadNodeResources } from "@webforge/pipeline/node";
import { siteLibrary } from "@webforge/site-components";
import { siteFromTemplate } from "@webforge/templates";
import type { TemplateFolder } from "@webforge/templates/node";
import { themePreset } from "@webforge/themes";

/**
 * Exports `folder`'s template into `dir`, as a site made from it starts: in the template's own
 * theme, through the export pipeline, its photos from the template's folder. Returns the pages'
 * paths in the export (`index.html`, `about.html`, …).
 */
export async function exportTemplate(
  { template, images, imagesDir }: TemplateFolder,
  dir: string,
): Promise<string[]> {
  const theme = themePreset(template.site.theme.preset) ?? template.site.theme;
  const site = siteFromTemplate(template, images, {
    name: template.site.settings.general.name,
    theme,
  });
  const blobs = new Map(
    images.map((image) => [image.hash, new Uint8Array(readFileSync(join(imagesDir, image.file)))]),
  );
  const built = await buildSite(
    siteToSnapshot(site, blobs),
    siteLibrary,
    await loadNodeResources(),
  );
  for (const [path, bytes] of built.files) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), bytes);
  }
  return [...built.files.keys()].filter((path) => path.endsWith(".html"));
}
