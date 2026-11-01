import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { createSite } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { launchDesktopApp, type WebforgeApp, waitForCanvas } from "./launch.js";
import { exportFromEditor, stubFileDialogs } from "./sites.js";

// Download and bundle (C8, 3.9): Site Check stops the export for a stylesheet the site's code
// loads from another website, and its Fix keeps a copy with the site, the font it names too, once
// the person says yes. The network is stood in for (WEBFORGE_E2E_BUNDLE): no test reaches another
// website.

const KIT = "https://cdn.example.com/kit.css";

let dir: string;
let app: WebforgeApp | undefined;
let page: Page;

test.beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "webforge-bundle-"));
  const sitePath = join(dir, "Rosa's Bakery.wforge");
  const site = createSite({
    name: "Rosa's Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Page not found",
  });
  site.code = { ...site.code, head: `<link rel="stylesheet" href="${KIT}">` };
  const store = ProjectStore.create(sitePath, { name: "Rosa's Bakery" });
  store.saveSite(site);
  store.close();
  app = await launchDesktopApp({ userDataDir: join(dir, "user-data"), args: [sitePath] });
  page = await app.firstWindow();
  await waitForCanvas(page);
  // The stylesheet and the font it names, as the website would answer, and what was asked for.
  await app.evaluate(() => {
    const asked: string[] = [];
    const files: Record<string, [string, string]> = {
      "https://cdn.example.com/kit.css": [
        "@font-face { font-family: Kit; src: url(fonts/kit.woff2); }\n.kit { font-family: Kit; }",
        "text/css",
      ],
      "https://cdn.example.com/fonts/kit.woff2": ["wOF2", "font/woff2"],
    };
    Object.assign(globalThis, {
      bundleAsked: asked,
      // No DNS query either: every host is another website's.
      webforgeBundleResolve: async () => ["93.184.215.14"],
      webforgeBundleFetch: async (url: string) => {
        asked.push(url);
        const file = files[url];
        return file === undefined
          ? new Response("Not found", { status: 404 })
          : new Response(file[0], { headers: { "content-type": file[1] } });
      },
    });
  });
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

const drawer = () => page.getByRole("region", { name: "Bottom panel" });
const rule = () => drawer().locator('[data-rule="externalResources"]');
const asked = () =>
  app?.evaluate(() => (globalThis as unknown as { bundleAsked: string[] }).bundleAsked.slice());

test("keeps a copy of a file from another website with the site, once the person says yes", async () => {
  await page.getByRole("button", { name: "Show or Hide Bottom Panel" }).click();
  await expect(rule()).toHaveAttribute("data-status", "fail");
  await expect(rule()).toContainText(KIT);

  // Nothing is downloaded until the person says yes, and the licence is theirs to check.
  await rule().getByRole("button", { name: "Fix" }).click();
  const question = page.getByRole("alertdialog", {
    name: "Keep a copy of this file with your site?",
  });
  await expect(question).toContainText("Make sure its licence lets you share it with your site.");
  expect(await asked()).toEqual([]);
  await question.getByRole("button", { name: "Download and Bundle" }).click();

  await expect(rule()).toHaveAttribute("data-status", "pass");
  expect(await asked()).toEqual([KIT, "https://cdn.example.com/fonts/kit.woff2"]);

  // The export loads its own copies, the font beside its stylesheet.
  const folder = join(dir, "exported");
  if (app === undefined) throw new Error("The app is not running");
  await stubFileDialogs(app, folder);
  // The stylesheet's link came with the site's file: the owner keeps it (#649).
  await exportFromEditor(page, 30_000, "Keep the code");
  const vendor = readdirSync(join(folder, "assets", "vendor")).sort();
  expect(vendor).toEqual([
    expect.stringMatching(/^kit-[0-9a-f]{8}\.css$/),
    expect.stringMatching(/^kit-[0-9a-f]{8}\.woff2$/),
  ]);
  const [css = "", font = ""] = vendor;
  expect(readFileSync(join(folder, "index.html"), "utf8")).toContain(
    `<link rel="stylesheet" href="assets/vendor/${css}">`,
  );
  expect(readFileSync(join(folder, "assets", "vendor", css), "utf8")).toContain(`url(${font})`);
});
