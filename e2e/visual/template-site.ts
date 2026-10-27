import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Page } from "@playwright/test";
import { siteToSnapshot } from "@webforge/model";
import { buildSite } from "@webforge/pipeline";
import { loadNodeResources } from "@webforge/pipeline/node";
import { siteLibrary } from "@webforge/site-components";
import { siteFromTemplate } from "@webforge/templates";
import type { TemplateFolder } from "@webforge/templates/node";
import { themePreset } from "@webforge/themes";
import { serveSite } from "../export/served-site.js";

/** A template built as a site and served: each page's address, by its path in the export. */
export type BuiltTemplate = { readonly pages: ReadonlyMap<string, string> };

/**
 * Builds `folder`'s template as an exported site in the template's own theme, as a site made from
 * it starts, writes it to a folder of its own and serves it over http for `use`, as a host would:
 * the "Page not found" page's links start at the site's root (F-ED-20, 3.5), so it isn't drawn
 * from disk. Removes the folder afterwards.
 */
export async function withBuiltTemplate(
  { template, images, imagesDir }: TemplateFolder,
  use: (site: BuiltTemplate) => Promise<void>,
): Promise<void> {
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
  const dir = mkdtempSync(join(tmpdir(), "webforge-template-"));
  try {
    for (const [path, bytes] of built.files) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), bytes);
    }
    const served = await serveSite(dir);
    try {
      const pages = [...built.files.keys()]
        .filter((path) => path.endsWith(".html"))
        .map((path): [string, string] => [path, `${served.origin}/${path}`]);
      await use({ pages: new Map(pages) });
    } finally {
      await served.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Opens `address` and waits for its fonts and every photo, so nothing shows half loaded. */
export async function openPage(page: Page, address: string): Promise<void> {
  await page.goto(address);
  await page.evaluate(() => document.fonts.ready);
  // Served over http, photos below the fold load lazily, as the page scrolls: load them all now,
  // so a full-page screenshot never catches one half loaded.
  await page.evaluate(async () => {
    const images = [...document.images];
    for (const image of images) image.loading = "eager";
    await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
  });
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
}
