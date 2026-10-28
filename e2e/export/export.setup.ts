import { mkdtempSync, rmSync } from "node:fs";
import { rm } from "node:fs/promises";
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
  choices: { format: "folder"; minify: false; developerFiles: false; askWebAddress: true };
  output: { minify: false; developerFiles: false };
};
type ExportingWindow = { webforge: { site: { export(request: ExportRequest): Promise<unknown> } } };

// Exports the three-page fixture site, and its "Page not found" page, (with its photo and price list)
// through the real app: preload API, IPC, export utility process. The browser projects then open
// the result from disk. As in the app, the photo's and the document's bytes come from the open
// site's file; the renderer names them by hash.
/** `site` with its photo behind the About page's Text section, under a strong overlay (2.26). */
function withSectionBackground(site: SiteSnapshot): SiteSnapshot {
  return {
    ...site,
    pages: site.pages.map((page) =>
      page.path !== "about"
        ? page
        : {
            ...page,
            doc: {
              ...page.doc,
              content: page.doc.content.map((node) =>
                node.props.id === "story"
                  ? {
                      ...node,
                      props: {
                        ...node.props,
                        backgroundImage: { mediaId: "hero-photo" },
                        overlay: "80",
                      },
                    }
                  : node,
              ),
            },
          },
    ),
  };
}

/**
 * `site` in a theme of its own (#423): square, large, outline buttons, strong shadows and links
 * underlined only on hover, with running text that has a link in it and a Button set to Filled on the
 * home page; Google Analytics with its consent banner (3.8); and Web3Forms with the web address,
 * so its forms send visitors to a thank-you page (3.7); and code of its own (3.9).
 */
function themed(site: SiteSnapshot): SiteSnapshot {
  const [home, ...rest] = site.pages;
  if (home === undefined) throw new Error("The fixture site has no pages");
  const linked: NodeDoc = {
    type: "Text",
    props: { id: "linked", text: '<p>Read <a href="about.html">our story</a>.</p>' },
  };
  // A Reversed section with a link in its text: the link takes the inverse main colour.
  const reversed: NodeDoc = {
    type: "Section",
    props: {
      id: "reversed",
      colors: "inverse",
      content: [
        {
          type: "Text",
          props: { id: "reversed-text", text: '<p>See <a href="about.html">our menu</a>.</p>' },
        },
      ],
    },
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
    // Google Analytics behind its consent banner (3.8): consent.spec.ts opens it from disk.
    analytics: { measurementId: "G-ABC123DEF4", consentBanner: true },
    // Web3Forms, which sends a visitor to the site's thank-you page, and the web address it needs
    // to (3.7): forms.spec.ts opens them from disk.
    formService: { kind: "web3forms", accessKey: "0f8fad5b-d9cb-469f-a165-70867728950e" },
    settings: { ...site.settings, "address.url": "https://rosas-bakery.example" },
    // The site's own code (3.9): site-code.spec.ts checks each part runs from disk. The note's
    // classes are single-quoted, and `tracking-widest` is used nowhere else.
    code: {
      css: "#own-note {\n  outline: 3px solid rgb(255, 0, 0);\n}",
      js: 'function ownGreeting() {\n  return "Hello";\n}\ndocument.documentElement.dataset.ownScript = "ran";',
      head: '<meta name="own-head" content="yes">',
      bodyEnd: "<p id='own-note' class='tracking-widest'>Thanks for visiting</p>",
    },
    pages: [
      { ...home, doc: { ...home.doc, content: [...home.doc.content, linked, filled, reversed] } },
      ...rest,
    ],
  };
}

setup("export the fixture site from the app", async () => {
  rmSync(EXPORTED_SITE_DIR, { recursive: true, force: true });
  // With its photo as the icon, the About page's share picture (3.4), and a "Page not found" page
  // with the home page's Hero, its photo and links (F-ED-20, 3.5).
  const sample = withSectionBackground(sampleSite());
  const notFound = {
    id: "lost",
    path: "404",
    title: "Page not found",
    hideFromNavigation: true,
    doc: { root: { props: {} }, content: sample.pages[0]?.doc.content.slice(0, 1) ?? [] },
  };
  const site = {
    ...sample,
    icon: "hero-photo",
    pages: [
      ...sample.pages.map((page) =>
        page.path === "about" ? { ...page, shareImage: "hero-photo" } : page,
      ),
      notFound,
    ],
  };
  const dir = mkdtempSync(join(tmpdir(), "webforge-e2e-fixture-"));
  const sitePath = join(dir, "Fixture.wforge");
  const store = ProjectStore.create(sitePath, { name: "Fixture" });
  /** The fixture's own bytes: sampleSite carries every file's. */
  const bytes = (item: { readonly data?: Uint8Array | undefined }) => {
    if (item.data === undefined) throw new Error("The fixture site has a file without bytes");
    return item.data;
  };
  const media = site.media.map((item) => ({
    id: item.id,
    name: item.name,
    mimeType: item.mimeType,
    alt: item.alt ?? "",
    hash: store.putAsset({
      mediaId: item.id,
      data: bytes(item),
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
      data: bytes(item),
      mime: item.mimeType,
      originalName: `${item.name}.pdf`,
    }).hash,
  }));
  store.close();

  // A readable folder, as an export is unless the person chooses otherwise (3.3).
  const choices = {
    format: "folder",
    minify: false,
    developerFiles: false,
    askWebAddress: true,
  } as const;
  const output = { minify: false, developerFiles: false } as const;
  const app = await launchDesktopApp({ args: [sitePath] });
  try {
    const page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await stubFileDialogs(app, EXPORTED_SITE_DIR);

    const result = await page.evaluate(
      (request) => (window as unknown as ExportingWindow).webforge.site.export(request),
      { snapshot: { ...site, media: [], documents: [] }, media, documents, choices, output },
    );

    // With "Page not found" (3.5). One warning: the fixture's second Newsletter has no form address,
    // on purpose (3.7).
    expect(result).toMatchObject({ status: "exported", pages: 4, warningCount: 1 });

    // Again in a theme of its own, into a folder inside the first.
    await stubFileDialogs(app, THEMED_SITE_DIR);
    const again = await page.evaluate(
      (request) => (window as unknown as ExportingWindow).webforge.site.export(request),
      {
        snapshot: { ...themed(site), media: [], documents: [] },
        media,
        documents,
        choices,
        output,
      },
    );
    // With the thank-you page Web3Forms sends visitors to (3.7).
    expect(again).toMatchObject({ status: "exported", pages: 5, warningCount: 1 });
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
