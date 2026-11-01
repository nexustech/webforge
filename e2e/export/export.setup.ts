import { mkdtempSync, rmSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test as setup } from "@playwright/test";
import {
  DEFAULT_THEME,
  expandSharedCopies,
  type NodeDoc,
  SHARED_COPY_TYPE,
  type SharedSectionId,
  type SharedSectionsDoc,
  type SiteSnapshot,
} from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { readTemplates } from "@webforge/templates/node";
import { sampleSite } from "@webforge/test-utils";
import { launchDesktopApp } from "../app/launch.js";
import { stubFileDialogs } from "../app/sites.js";
import {
  CHECK_TEMPLATES,
  EXPORTED_SITE_DIR,
  NO_BANNER_SITE_DIR,
  TEMPLATES_DIR,
  THEMED_SITE_DIR,
} from "./exported-site.js";
import { exportSnapshot, exportTemplate } from "./template-export.js";

type ExportRequest = {
  snapshot: SiteSnapshot;
  media: { id: string; name: string; mimeType: string; hash: string; alt: string }[];
  documents: { id: string; name: string; mimeType: string; hash: string }[];
  choices: { format: "folder"; minify: false; developerFiles: false; askWebAddress: true };
  output: { minify: false; developerFiles: false };
};
type ExportingWindow = {
  webforge: {
    project: { getCurrent(): Promise<{ sessionId: string } | null> };
    site: { export(sessionId: string, request: ExportRequest): Promise<unknown> };
    trust: { trust(sessionId: string, texts: readonly string[]): Promise<unknown> };
  };
};

/** Exports `request` as the page does: for the opening of the site it was loaded for (#663). */
const exportFromPage = async (request: ExportRequest) => {
  const { webforge } = window as unknown as ExportingWindow;
  const current = await webforge.project.getCurrent();
  return webforge.site.export(current?.sessionId ?? "", request);
};

/**
 * The fixture's own code: Settings' Script, Head and End of page, and each Custom Code element's.
 * Main builds it only once the owner trusts it (#649), as *Keep the code* does.
 */
function codeOf(site: SiteSnapshot): string[] {
  const texts = [site.code?.js ?? "", site.code?.head ?? "", site.code?.bodyEnd ?? ""];
  JSON.stringify(site, (_key, value: unknown) => {
    const node = value as { type?: unknown; props?: { code?: unknown } } | null;
    if (node?.type === "CustomCode" && typeof node.props?.code === "string") {
      texts.push(node.props.code);
    }
    return value;
  });
  return texts.filter((text) => text.trim() !== "");
}

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
 * `site` with two Images of its photo cut to shapes (3.19) on the About page, side by side: a
 * Medium one in a Portrait frame, which opens larger when clicked (3.20), and a Small one at a
 * Large set height.
 */
function withShapedImages(site: SiteSnapshot): SiteSnapshot {
  const image = (id: string, props: Record<string, unknown>): NodeDoc => ({
    type: "Column",
    props: { id: `${id}-column`, content: [{ type: "Image", props: { id, ...props } }] },
  });
  const shapes: NodeDoc = {
    type: "Section",
    props: {
      id: "shapes",
      advanced: { anchorId: "shapes" },
      content: [
        {
          type: "Columns",
          props: {
            id: "shapes-columns",
            columns: [
              image("portrait-image", {
                image: { mediaId: "hero-photo", alt: "Hills in a portrait frame" },
                width: "medium",
                shape: "portrait",
                caption: "Our fields",
                enlarge: true,
              }),
              image("tall-image", {
                image: { mediaId: "hero-photo", alt: "Hills at a set height" },
                width: "small",
                shape: "height",
                height: "large",
              }),
            ],
          },
        },
      ],
    },
  };
  return {
    ...site,
    pages: site.pages.map((page) =>
      page.path !== "about"
        ? page
        : { ...page, doc: { ...page.doc, content: [...page.doc.content, shapes] } },
    ),
  };
}

/** The fixture's shared section (F-ED-23): opening hours, with an anchor a link goes to. */
const HOURS = "hours" as SharedSectionId;
const SHARED_SECTIONS: SharedSectionsDoc = {
  [HOURS]: {
    id: HOURS,
    name: "Opening hours",
    section: {
      type: "Section",
      props: {
        id: "hours-section",
        advanced: { anchorId: "opening-hours" },
        content: [
          {
            type: "Text",
            props: { id: "hours-text", text: "<p>Open Tuesday to Saturday, 7am to 3pm.</p>" },
          },
        ],
      },
    },
  },
};

/**
 * `site` with the shared section placed on two pages (3.10), as linked copies the editor expands
 * on its way to the export (`siteToSnapshot`): the home page and the About page show the same
 * section, each with its anchor.
 */
function withSharedSection(site: SiteSnapshot): SiteSnapshot {
  const copy = (id: string): NodeDoc => ({
    type: SHARED_COPY_TYPE,
    props: { id, sharedSectionId: HOURS },
  });
  return {
    ...site,
    pages: site.pages.map((page) =>
      page.path === "index" || page.path === "about"
        ? {
            ...page,
            doc: {
              ...page.doc,
              content: expandSharedCopies(
                [...page.doc.content, copy(`hours-on-${page.path}`)],
                SHARED_SECTIONS,
              ),
            },
          }
        : page,
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
  // With its photo as the icon, the About page's share picture (3.4) and Images cut to shapes
  // (3.19), and a "Page not found" page with the home page's Hero, its photo and links (F-ED-20,
  // 3.5).
  const sample = withSharedSection(withShapedImages(withSectionBackground(sampleSite())));
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
    await page.evaluate(
      async (texts) => {
        const { project, trust } = (window as unknown as ExportingWindow).webforge;
        await trust.trust((await project.getCurrent())?.sessionId ?? "", texts);
      },
      [...codeOf(site), ...codeOf(themed(site))],
    );

    const result = await page.evaluate(exportFromPage, {
      snapshot: { ...site, media: [], documents: [] },
      media,
      documents,
      choices,
      output,
    });

    // With "Page not found" (3.5). One warning: the fixture's second Newsletter has no form address,
    // on purpose (3.7).
    expect(result).toMatchObject({ status: "exported", pages: 4, warningCount: 1 });

    // Again in a theme of its own, into a folder inside the first.
    await stubFileDialogs(app, THEMED_SITE_DIR);
    const again = await page.evaluate(exportFromPage, {
      snapshot: { ...themed(site), media: [], documents: [] },
      media,
      documents,
      choices,
      output,
    });
    // With the thank-you page Web3Forms sends visitors to (3.7).
    expect(again).toMatchObject({ status: "exported", pages: 5, warningCount: 1 });
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

setup("export a site whose owner turned the consent banner off (#650)", async () => {
  const sample = sampleSite();
  const [home] = sample.pages;
  if (home === undefined) throw new Error("The fixture site has no pages");
  const heading: NodeDoc = { type: "Heading", props: { id: "welcome", text: "Welcome" } };
  rmSync(NO_BANNER_SITE_DIR, { recursive: true, force: true });
  // One page and no files, through the pipeline alone: only its analytics matter here.
  const pages = await exportSnapshot(
    {
      ...sample,
      media: [],
      documents: [],
      pages: [{ ...home, doc: { root: { props: {} }, content: [heading] } }],
      analytics: { measurementId: "G-ABC123DEF4", consentBanner: false },
    },
    NO_BANNER_SITE_DIR,
  );
  expect(pages).toContain("index.html");
});

setup("export every template, as a site made from it starts (3.10)", async () => {
  setup.skip(!CHECK_TEMPLATES, "Nothing the templates are made from has changed");
  const folders = readTemplates();
  // Each template's photos are encoded in each size and format: up to a minute apiece on a loaded
  // CI runner.
  setup.setTimeout(folders.length * 60_000);
  rmSync(TEMPLATES_DIR, { recursive: true, force: true });
  for (const folder of folders) {
    const pages = await exportTemplate(folder, join(TEMPLATES_DIR, folder.template.id));
    expect(pages, folder.template.id).toContain("index.html");
  }
});
