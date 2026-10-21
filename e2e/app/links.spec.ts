import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { createSite, type PageId } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { launchDesktopApp } from "./launch.js";
import { stubFileDialogs } from "./sites.js";

// Links (1.19, F-ED-18): a button links to a section on another page; renaming that page keeps
// the exported link working, and the section gets its anchor.

let dir: string;
let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "webforge-links-"));
  const sitePath = join(dir, "Links.wforge");
  const site = createSite({
    name: "Links",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
  });
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  home.doc.content.push({
    type: "Hero",
    props: { id: "hero", title: "Fresh bread", text: "Baked daily", buttonLabel: "Visit us" },
  });
  const about = "page-about" as PageId;
  site.pages[about] = {
    ...structuredClone(home),
    id: about,
    slug: "about",
    title: "About",
    doc: {
      root: { props: {} },
      content: [
        { type: "Section", props: { id: "times", layerName: "Opening times", content: [] } },
      ],
    },
  };
  site.pageOrder.splice(1, 0, about);
  const store = ProjectStore.create(sitePath, { name: "Links" });
  store.saveSite(site);
  store.close();
  app = await launchDesktopApp({ args: [sitePath] });
  page = await app.firstWindow();
  await expect(canvas().locator("style[data-webforge-site-css]")).toHaveCount(1);
});

test.afterEach(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const right = () => page.getByRole("region", { name: "Right panels" });

test("links a button to a section, and the exported link follows a renamed page", async () => {
  // Select the Hero by its edge, clear of its inline-editable text.
  const hero = canvas().locator(".site-hero");
  const { height } = await hero.evaluate((element) => element.getBoundingClientRect());
  await hero.click({ position: { x: 8, y: height - 8 } });
  await expect(right().getByRole("heading", { name: "Hero", exact: true })).toBeVisible();

  await right().getByRole("button", { name: "Add Link…" }).click();
  const dialog = page.getByRole("dialog", { name: "Link" });
  await dialog.getByRole("combobox", { name: "Page" }).selectOption("About");
  await dialog.getByRole("combobox", { name: "Section" }).selectOption("Opening times");
  await dialog.getByRole("button", { name: "Save Link" }).click();
  await expect(right().getByText("About › Opening times")).toBeVisible();

  // Rename the page: its file name follows.
  await right().getByRole("tab", { name: "Site" }).click();
  await right().getByRole("button", { name: "Actions for About" }).click();
  await page.getByRole("menuitem", { name: "Rename…" }).click();
  await page.getByRole("textbox", { name: "Page name" }).fill("Our story");
  await page.getByRole("dialog").getByRole("button", { name: "Rename" }).click();

  const folder = join(dir, "export");
  await stubFileDialogs(app, folder);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByText(/^Site exported to/)).toBeVisible({ timeout: 30_000 });

  expect(readFileSync(join(folder, "index.html"), "utf8")).toContain(
    'href="our-story.html#opening-times"',
  );
  expect(readFileSync(join(folder, "our-story.html"), "utf8")).toContain('id="opening-times"');
});
