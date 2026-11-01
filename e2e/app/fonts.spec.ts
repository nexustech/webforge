import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { changedDocuments, createSite } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { FONTSOURCE_API, PACKAGE_FILES, PACKAGE_LISTINGS } from "@webforge/themes/font-plan";
import { desktopDir, launchDesktopApp, waitForCanvas } from "./launch.js";
import { exportFromEditor, stubFileDialogs } from "./sites.js";

// A font downloaded on demand (2.2, S4, PH2-8) works offline. It comes once from a stand-in for
// Fontsource and jsDelivr, then shows on the canvas and goes into an export after the app has
// started again with every request refused. Launched with `WEBFORGE_E2E_FONTS=1`, the main process
// fetches fonts through `webforgeFontFetch` on its globals when one is there, looked up as it
// downloads, so putting one there works, as replacing the file dialogs does.

/** The test font: any real WOFF2 works, as its family name comes from its metadata. */
const FILE = "test-script-latin-400-normal.woff2";
const BYTES = readFileSync(join(desktopDir, "out/fonts/pacifico-latin-400-normal.woff2"));
const PACKAGE = "@fontsource/test-script";

/** What Fontsource and jsDelivr answer for the font `test-script`, by URL, as the real ones do. */
const ANSWERS: Readonly<Record<string, unknown>> = {
  // Fontsource's whole list, for Browse all fonts (2.3c): Test Script only.
  [`${FONTSOURCE_API}/fonts`]: [
    {
      id: "test-script",
      family: "Test Script",
      subsets: ["latin"],
      category: "handwriting",
      license: "OFL-1.1",
      variable: false,
    },
  ],
  [`${FONTSOURCE_API}/fonts/test-script`]: {
    id: "test-script",
    family: "Test Script",
    subsets: ["latin"],
    weights: [400],
    styles: ["normal"],
    variable: false,
    category: "handwriting",
    license: "OFL-1.1",
    unicodeRange: { latin: "U+0000-00FF" },
  },
  [`${PACKAGE_LISTINGS}/${PACKAGE}/resolved?specifier=latest`]: { version: "5.3.0" },
  [`${PACKAGE_LISTINGS}/${PACKAGE}@5.3.0?structure=flat`]: {
    files: [
      {
        name: `/files/${FILE}`,
        hash: createHash("sha256").update(BYTES).digest("base64"),
        size: BYTES.byteLength,
      },
    ],
  },
};

/** Makes the main process's font fetch answer as Fontsource would for Test Script, and nothing else. */
async function standInForFontsource(app: ElectronApplication): Promise<void> {
  await app.evaluate(
    (_electron, { answers, fontUrl, font }) => {
      const requests: string[] = [];
      Object.assign(globalThis, { fontRequests: requests });
      const webforgeFontFetch = async (url: string) => {
        requests.push(url);
        if (url === fontUrl) return new Response(Buffer.from(font, "base64"));
        const answer = answers[url];
        return answer === undefined
          ? new Response("Not found", { status: 404 })
          : Response.json(answer);
      };
      Object.assign(globalThis, { webforgeFontFetch });
    },
    {
      answers: ANSWERS,
      fontUrl: `${PACKAGE_FILES}/${PACKAGE}@5.3.0/files/${FILE}`,
      font: BYTES.toString("base64"),
    },
  );
}

/** Makes every request of the main process fail, as with no network; records what was tried. */
async function cutOffTheNetwork(app: ElectronApplication): Promise<void> {
  await app.evaluate(() => {
    const requests: string[] = [];
    const webforgeFontFetch = async (url: string) => {
      requests.push(url);
      throw new TypeError("net::ERR_INTERNET_DISCONNECTED");
    };
    Object.assign(globalThis, { fontRequests: requests, webforgeFontFetch });
  });
}

const requestsTried = (app: ElectronApplication) =>
  app.evaluate(() => (globalThis as unknown as { fontRequests: string[] }).fontRequests);

/** Creates a site with a Hero, its text set in Test Script, which the computer doesn't have yet. */
function createSiteInTestScript(path: string): void {
  const site = createSite({
    name: "Fonts",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Page not found",
  });
  site.theme = {
    ...site.theme,
    // Headings too: the Hero's title is in the heading font (#419).
    fonts: {
      heading: { family: "Test Script", fallback: "serif" },
      body: { family: "Test Script", fallback: "serif" },
      accent: { family: "Test Script", fallback: "serif" },
    },
  };
  site.pages[site.homePageId]?.doc.content.push({
    type: "Hero",
    props: { id: "hero", title: "Fresh bread daily" },
  });
  const store = ProjectStore.create(path, { name: "Fonts" });
  try {
    store.commit(changedDocuments(undefined, site));
  } finally {
    store.close();
  }
}

const canvas = (page: Page) => page.frameLocator(".editor__canvas iframe");

/** Whether the canvas loaded Test Script, through the main process's `webforge-font:` scheme. */
const testScriptLoaded = (page: Page) =>
  canvas(page)
    .locator("body")
    .evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].some(
        (font) => font.family.replaceAll('"', "") === "Test Script" && font.status === "loaded",
      );
    });

let dir: string;
let app: ElectronApplication | undefined;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-e2e-fonts-"));
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

test("a downloaded font shows and exports offline, after a restart", async () => {
  const sitePath = join(dir, "Fonts.wforge");
  const userDataDir = join(dir, "user-data");
  createSiteInTestScript(sitePath);

  app = await launchDesktopApp({ args: [sitePath], userDataDir });
  await standInForFontsource(app);
  let page = await app.firstWindow();
  await waitForCanvas(page);
  expect(await testScriptLoaded(page)).toBe(false);

  const downloaded = await page.evaluate(() =>
    (
      window as unknown as { webforge: { fonts: { download(id: string): Promise<unknown> } } }
    ).webforge.fonts.download("test-script"),
  );
  expect(downloaded).toMatchObject({
    status: "downloaded",
    font: { family: "Test Script", source: "downloaded" },
  });

  await app.close();
  app = await launchDesktopApp({ args: [sitePath], userDataDir });
  await cutOffTheNetwork(app);
  page = await app.firstWindow();
  await waitForCanvas(page);

  await expect(canvas(page).locator(".site-hero h1")).toHaveCSS("font-family", /Test Script/);
  await expect.poll(() => testScriptLoaded(page)).toBe(true);

  const folder = join(dir, "export");
  await stubFileDialogs(app, folder);
  expect(await exportFromEditor(page)).toContain("Saved in the folder “export”.");
  expect(readFileSync(join(folder, "assets", "fonts", FILE))).toEqual(BYTES);
  const [css] = readdirSync(join(folder, "assets", "css"));
  expect(readFileSync(join(folder, "assets", "css", css ?? ""), "utf8")).toContain(
    `src: url("../fonts/${FILE}") format("woff2")`,
  );
  // Everything came from the computer: nothing was even tried over the network.
  expect(await requestsTried(app)).toEqual([]);
});

test("the font picker lists the fonts to download only when asked, and uses one once downloaded", async () => {
  const sitePath = join(dir, "Picker.wforge");
  ProjectStore.create(sitePath, { name: "Picker" }).close();
  app = await launchDesktopApp({ args: [sitePath], userDataDir: join(dir, "user-data") });
  await standInForFontsource(app);
  const page = await app.firstWindow();
  await waitForCanvas(page);

  await page
    .getByRole("region", { name: "Right panels" })
    .getByRole("tab", { name: "Theme", exact: true })
    .click();
  await page.getByRole("button", { name: "Headings Inter" }).click();
  const picker = page.getByRole("dialog", { name: "Choose a font" });
  await expect(picker.getByRole("option", { name: /Inter/ }).first()).toBeVisible();
  // P8: Fontsource is reached only when the person browses all fonts.
  expect(await requestsTried(app)).toEqual([]);

  await picker.getByRole("button", { name: "Browse all fonts" }).click();
  await picker.getByRole("button", { name: "To download" }).click();
  await picker.getByRole("option", { name: /Test Script/ }).dblclick();
  // A built-in theme is read-only (2.23): the first change saves the person's own version.
  await page
    .getByRole("dialog", { name: "Save your own version of 'Light'?" })
    .getByRole("button", { name: "Save Theme" })
    .click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Change Fonts" }).click();

  await expect(page.getByRole("button", { name: "Headings Test Script" })).toBeVisible();
  await expect(canvas(page).locator("h1").first()).toHaveCSS("font-family", /Test Script/);
  await page.getByRole("tab", { name: "Undo History" }).click();
  await expect(page.locator(".undo-history__step").first()).toHaveText(
    "Saved theme 'Light (my version)'",
  );
  expect((await requestsTried(app))[0]).toBe(`${FONTSOURCE_API}/fonts`);
});
