import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { changedDocuments, createSite } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { FONTSOURCE_API, PACKAGE_FILES, PACKAGE_LISTINGS } from "@webforge/themes/font-plan";
import { desktopDir, launchDesktopApp, waitForCanvas } from "./launch.js";
import { stubFileDialogs } from "./sites.js";

// A font downloaded on demand (2.2, S4, PH2-8) works offline. It comes once from a stand-in for
// Fontsource and jsDelivr, then shows on the canvas and goes into an export after the app has
// started again with every request refused. The main process looks `net.fetch` up when it
// downloads, so replacing it works, as replacing the file dialogs does.

/** The test font: any real WOFF2 works, as its family name comes from its metadata. */
const FILE = "test-script-latin-400-normal.woff2";
const BYTES = readFileSync(join(desktopDir, "out/fonts/pacifico-latin-400-normal.woff2"));
const PACKAGE = "@fontsource/test-script";

/** What Fontsource and jsDelivr answer for the font `test-script`, by URL, as the real ones do. */
const ANSWERS: Readonly<Record<string, unknown>> = {
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

/** Makes the main process's `net.fetch` answer as Fontsource would for Test Script, and nothing else. */
async function standInForFontsource(app: ElectronApplication): Promise<void> {
  await app.evaluate(
    ({ net }, { answers, fontUrl, font }) => {
      net.fetch = async (input: string | Request) => {
        const url = typeof input === "string" ? input : input.url;
        if (url === fontUrl) return new Response(Buffer.from(font, "base64"));
        const answer = answers[url];
        return answer === undefined
          ? new Response("Not found", { status: 404 })
          : Response.json(answer);
      };
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
  await app.evaluate(({ net }) => {
    const requests: string[] = [];
    Object.assign(globalThis, { fontRequests: requests });
    net.fetch = async (input: string | Request) => {
      requests.push(typeof input === "string" ? input : input.url);
      throw new TypeError("net::ERR_INTERNET_DISCONNECTED");
    };
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
    fonts: { ...site.theme.fonts, body: { family: "Test Script", fallback: "serif" } },
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
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
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
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByText(/^Site exported to “export”/)).toBeVisible({ timeout: 30_000 });
  expect(readFileSync(join(folder, "assets", "fonts", FILE))).toEqual(BYTES);
  const [css] = readdirSync(join(folder, "assets", "css"));
  expect(readFileSync(join(folder, "assets", "css", css ?? ""), "utf8")).toContain(
    `src: url("../fonts/${FILE}") format("woff2")`,
  );
  // Everything came from the computer: nothing was even tried over the network.
  expect(await requestsTried(app)).toEqual([]);
});
