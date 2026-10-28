import { mkdtempSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { createSite, type PageId } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { exportFromEditor, stubFileDialogs } from "./sites.js";

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
  home.doc.content.push({
    type: "Section",
    props: {
      id: "order",
      content: [
        {
          type: "Text",
          props: {
            id: "order-text",
            text: '<p>Order at <a href="https://example.com/cakes">our cake shop</a>.</p>',
          },
        },
      ],
    },
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
  await waitForCanvas(page);
});

test.afterEach(async () => {
  await app.close();
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

const right = () => page.getByRole("region", { name: "Right panels" });

test("links a button to a section, and the exported link follows a renamed page", async () => {
  // Select the Hero in Layers: no canvas geometry, whatever the zoom.
  const left = page.getByRole("region", { name: "Left panels" });
  await left.getByRole("treeitem", { name: /^Hero/ }).click();
  await expect(right().getByRole("heading", { name: "Hero", exact: true })).toBeVisible();

  await right().getByRole("button", { name: "Add Link…" }).click();
  const dialog = page.getByRole("dialog", { name: "Link" });
  await dialog.getByRole("combobox", { name: "Page" }).selectOption("About");
  await dialog.getByRole("combobox", { name: "Section" }).selectOption("Opening times");
  await dialog.getByRole("button", { name: "Save Link" }).click();
  await expect(right().getByText("About › Opening times")).toBeVisible();

  // Rename the page: its file name follows.
  await right().getByRole("tab", { name: "Site" }).click();
  await right()
    .getByRole("list", { name: "Pages" })
    .getByRole("button", { name: "Actions for About" })
    .click();
  await page.getByRole("menuitem", { name: "Rename…" }).click();
  await page.getByRole("textbox", { name: "Page name" }).fill("Our story");
  await page.getByRole("dialog").getByRole("button", { name: "Rename" }).click();

  const folder = join(dir, "export");
  await stubFileDialogs(app, folder);
  await exportFromEditor(page);

  expect(readFileSync(join(folder, "index.html"), "utf8")).toContain(
    'href="our-story.html#opening-times"',
  );
  expect(readFileSync(join(folder, "our-story.html"), "utf8")).toContain('id="opening-times"');
});

test("follows no link on the canvas, from a click or Enter: the canvas stays on the page (#337)", async () => {
  const canvas = page.frameLocator(".editor__canvas iframe");
  const where = () =>
    page.evaluate(
      () =>
        document.querySelector<HTMLIFrameElement>(".editor__canvas iframe")?.contentWindow?.location
          .href,
    );
  const before = await where();

  for (const name of ["Visit us", "our cake shop"]) {
    const link = canvas.getByRole("link", { name });
    // Where a person clicks: on the element, which Puck's overlay covers.
    await link.click({ force: true });
    await link.focus();
    await page.keyboard.press("Enter");
    expect(await where(), name).toBe(before);
    await expect(canvas.getByRole("heading", { name: "Fresh bread" })).toBeVisible();
  }
});
