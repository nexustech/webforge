import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test as setup } from "@playwright/test";
import { DEFAULT_THEME, type NodeDoc, type SiteSnapshot } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { sampleSite } from "@webforge/test-utils";
import { launchDesktopApp } from "../app/launch.js";
import { stubFileDialogs } from "../app/sites.js";
import { EXPORTED_SITE_DIR, THEMED_SITE_DIR } from "./exported-site.js";

type ExportRequest = {
  snapshot: SiteSnapshot;
  media: { id: string; name: string; mimeType: string; hash: string; alt: string }[];
  documents: { id: string; name: string; mimeType: string; hash: string }[];
};
type ExportingWindow = { webforge: { site: { export(request: ExportRequest): Promise<unknown> } } };

// Exports the three-page fixture site (with its photo and price list) through the real app: preload
// API, IPC, export utility process. The browser projects then open the result from disk. As in the
// app, the photo's and the document's bytes come from the open site's file; the renderer names
// them by hash.
/**
 * `site` in a theme of its own (#423): square, large, outline buttons, strong shadows and links
 * underlined only on hover, with running text that has a link in it and a Button set to Filled on the
 * home page.
 */
function themed(site: SiteSnapshot): SiteSnapshot {
  const [home, ...rest] = site.pages;
  if (home === undefined) throw new Error("The fixture site has no pages");
  const linked: NodeDoc = {
    type: "Text",
    props: { id: "linked", text: '<p>Read <a href="about.html">our story</a>.</p>' },
  };
  // A Button the person set to Filled: the theme's outline style never reaches it (PH2-14).
  const filled: NodeDoc = {
    type: "Button",
    props: { id: "filled", label: "Call us", style: "primary", size: "medium" },
  };
  return {
    ...site,
    theme: {
      ...DEFAULT_THEME,
      preset: "outline",
      buttons: { shape: "square", size: "l", style: "outline" },
      shadow: "strong",
      links: { underline: "hover" },
    },
    pages: [
      { ...home, doc: { ...home.doc, content: [...home.doc.content, linked, filled] } },
      ...rest,
    ],
  };
}

setup("export the fixture site from the app", async () => {
  rmSync(EXPORTED_SITE_DIR, { recursive: true, force: true });
  const site = sampleSite();
  const dir = mkdtempSync(join(tmpdir(), "webforge-e2e-fixture-"));
  const sitePath = join(dir, "Fixture.wforge");
  const store = ProjectStore.create(sitePath, { name: "Fixture" });
  const media = site.media.map((item) => ({
    id: item.id,
    name: item.name,
    mimeType: item.mimeType,
    alt: item.alt ?? "",
    hash: store.putAsset({
      mediaId: item.id,
      data: item.data,
      mime: item.mimeType,
      originalName: `${item.name}.jpg`,
    }).hash,
  }));
  const documents = (site.documents ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    mimeType: item.mimeType,
    hash: store.putAsset({
      mediaId: item.id,
      data: item.data,
      mime: item.mimeType,
      originalName: `${item.name}.pdf`,
    }).hash,
  }));
  store.close();

  const app = await launchDesktopApp({ args: [sitePath] });
  try {
    const page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await stubFileDialogs(app, EXPORTED_SITE_DIR);

    const result = await page.evaluate(
      (request) => (window as unknown as ExportingWindow).webforge.site.export(request),
      { snapshot: { ...site, media: [], documents: [] }, media, documents },
    );

    expect(result).toMatchObject({ status: "exported", pages: 3, warnings: 0 });

    // Again in a theme of its own, into a folder inside the first.
    await stubFileDialogs(app, THEMED_SITE_DIR);
    const again = await page.evaluate(
      (request) => (window as unknown as ExportingWindow).webforge.site.export(request),
      { snapshot: { ...themed(site), media: [], documents: [] }, media, documents },
    );
    expect(again).toMatchObject({ status: "exported", pages: 3, warnings: 0 });
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
