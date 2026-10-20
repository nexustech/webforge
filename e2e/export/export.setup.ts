import { rmSync } from "node:fs";
import { expect, test as setup } from "@playwright/test";
import type { SiteSnapshot } from "@webforge/model";
import { sampleSite } from "@webforge/test-utils";
import { launchDesktopApp } from "../app/launch.js";
import { stubFileDialogs } from "../app/sites.js";
import { EXPORTED_SITE_DIR } from "./exported-site.js";

type ExportingWindow = { webforge: { site: { export(site: SiteSnapshot): Promise<unknown> } } };

// Exports the two-page fixture site (with its photo) through the real app: preload API, IPC,
// export utility process. The browser projects then open the result from disk.
setup("export the fixture site from the app", async () => {
  rmSync(EXPORTED_SITE_DIR, { recursive: true, force: true });
  const app = await launchDesktopApp();
  try {
    const page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await stubFileDialogs(app, EXPORTED_SITE_DIR);
    const site = sampleSite();
    // Typed arrays do not survive page.evaluate; send the media bytes as plain arrays.
    const media = site.media.map((item) => ({ ...item, data: [...item.data] }));

    const result = await page.evaluate(
      async ({ snapshot, items }) => {
        const withBytes = {
          ...snapshot,
          media: items.map((item) => ({ ...item, data: new Uint8Array(item.data) })),
        };
        return (window as unknown as ExportingWindow).webforge.site.export(withBytes);
      },
      { snapshot: { ...site, media: [] }, items: media },
    );

    expect(result).toMatchObject({ status: "exported", pages: 2, warnings: 0 });
  } finally {
    await app.close();
  }
});
