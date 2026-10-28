import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import type { TemplateFolder } from "@webforge/templates/node";
import { serveSite } from "../export/served-site.js";
import { exportTemplate } from "../export/template-export.js";

/** A template built as a site and served: each page's address, by its path in the export. */
export type BuiltTemplate = { readonly pages: ReadonlyMap<string, string> };

/**
 * Builds `folder`'s template as an exported site in the template's own theme, as a site made from
 * it starts, writes it to a folder of its own and serves it over http for `use`, as a host would:
 * the "Page not found" page's links start at the site's root (F-ED-20, 3.5), so it isn't drawn
 * from disk. Removes the folder afterwards.
 */
export async function withBuiltTemplate(
  folder: TemplateFolder,
  use: (site: BuiltTemplate) => Promise<void>,
): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "webforge-template-"));
  try {
    const paths = await exportTemplate(folder, dir);
    const served = await serveSite(dir);
    try {
      const pages = paths.map((path): [string, string] => [path, `${served.origin}/${path}`]);
      await use({ pages: new Map(pages) });
    } finally {
      await served.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Opens `address` and waits for its fonts and every photo, so nothing shows half loaded. With
 * `wholePage`, for a full-page screenshot, lazy photos load at once: one far down a tall page (a
 * background band on a phone, 2.29) would otherwise never start. Each is then waited for until
 * decoded, as a photo just switched to eager reads as complete before its request starts. A
 * thumbnail shows only the top, so it leaves the others lazy.
 */
export async function openPage(
  page: Page,
  address: string,
  { wholePage = false }: { readonly wholePage?: boolean } = {},
): Promise<void> {
  await page.goto(address);
  if (wholePage) {
    await page.evaluate(async () => {
      const images = [...document.images];
      for (const image of images) image.loading = "eager";
      await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
    });
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
}
