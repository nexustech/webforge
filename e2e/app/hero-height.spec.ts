import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { createSite } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// A Whole screen Hero on the canvas (HH-4): as tall as the part of the page in view, less the
// Header's band, at each device view, and steady. The canvas's frame grows with its page, so a
// height taken from the frame's own window would keep growing.

let dir: string;
let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  // A page opening with a Hero over its picture, under the Header's own band, and a section after.
  dir = mkdtempSync(join(tmpdir(), "webforge-hero-height-"));
  const sitePath = join(dir, "Hero.wforge");
  const site = createSite({
    name: "Hero",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
  });
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  home.doc.content = [
    {
      type: "Hero",
      props: { id: "hero", title: "Fresh bread", text: "Baked daily", variant: "background" },
    },
    {
      type: "TextSection",
      props: { id: "story", title: "Our story", text: "<p>Since 1998.</p>" },
    },
  ];
  const store = ProjectStore.create(sitePath, { name: "Hero" });
  store.saveSite(site);
  store.close();
  app = await launchDesktopApp({ args: [sitePath] });
  page = await app.firstWindow();
  await waitForCanvas(page);
  await expect(canvas().locator("h1")).toHaveText("Fresh bread");
});

test.afterEach(async () => {
  await app?.close();
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const left = () => page.getByRole("region", { name: "Left panels" });
const right = () => page.getByRole("region", { name: "Right panels" });
const toolbar = () => page.getByRole("toolbar", { name: "Canvas" });

/** The Hero's height, the Header's, the window's height the canvas gives, and the page's. */
const sizes = () =>
  canvas()
    .locator("body")
    .evaluate((body) => {
      const doc = body.ownerDocument;
      const height = (selector: string) =>
        doc.querySelector(selector)?.getBoundingClientRect().height ?? 0;
      return {
        hero: height(".site-hero"),
        header: height("header.site-header"),
        window: Number.parseFloat(
          getComputedStyle(doc.documentElement).getPropertyValue("--wf-viewport-h"),
        ),
        page: doc.documentElement.scrollHeight,
      };
    });

test("draws a Whole screen Hero as tall as the canvas shows, less the Header, and steady (HH-4)", async () => {
  await left().getByRole("treeitem", { name: /^Hero/ }).click();
  await expect(right().getByRole("heading", { name: "Hero", exact: true })).toBeVisible();
  await right().getByRole("tab", { name: "Style" }).click();
  await right().locator('[data-field="height"] select').selectOption("screen");

  for (const device of ["Desktop", "Tablet", "Mobile"] as const) {
    await toolbar().getByRole("radio", { name: device }).click();
    await expect(toolbar().getByRole("radio", { name: device })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    // The window less the Header: the two fill the part of the page in view.
    await expect
      .poll(async () => {
        const at = await sizes();
        return Math.abs(at.hero + at.header - at.window);
      }, device)
      .toBeLessThan(2);
    // And stays so: the page doesn't grow with it.
    const before = await sizes();
    await canvas()
      .locator("body")
      .evaluate(() => new Promise((resolve) => setTimeout(resolve, 600)));
    expect((await sizes()).page, device).toBe(before.page);
  }
});
