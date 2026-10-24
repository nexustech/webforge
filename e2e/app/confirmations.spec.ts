import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { createSite, type PageId } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { placeCaret } from "./caret.js";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// Site-wide confirmations (1.26, D7, F-ED-14): deleting a page, or an element of the shared Footer,
// says how many pages it changes first, and stays one undo step. Nothing else changes the site
// while the question is open.

let dir: string;
let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "webforge-confirm-"));
  const sitePath = join(dir, "Confirm.wforge");
  const site = createSite({
    name: "Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
  });
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  // An About page in the menu, so every page links to it.
  const about = "page-about" as PageId;
  site.pages[about] = { ...structuredClone(home), id: about, slug: "about", title: "About" };
  site.pageOrder.splice(1, 0, about);
  site.menu.items.push({ id: "about-item" as never, kind: "page", pageId: about, hidden: false });
  // A Section in the shared Footer, with two Headings every page shows.
  const heading = (id: string, text: string) => ({
    type: "Heading",
    props: { id, text, size: "medium", color: "default" },
  });
  site.layout.footer.push({
    type: "Section",
    props: {
      id: "footer-section",
      padding: { top: "m", bottom: "m" },
      gap: "medium",
      fullWidth: false,
      content: [heading("footer-hours", "Opening hours"), heading("footer-open", "Open daily")],
    },
  });
  const store = ProjectStore.create(sitePath, { name: "Bakery" });
  store.saveSite(site);
  store.close();
  app = await launchDesktopApp({ args: [sitePath] });
  page = await app.firstWindow();
  await waitForCanvas(page);
});

test.afterEach(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const confirmation = () => page.getByRole("alertdialog");
const right = () => page.getByRole("region", { name: "Right panels" });
const steps = () => page.locator(".undo-history__step");
/** A quick action of the selected element (a hovered element shows a bar of its own too). */
const quickAction = (title: string) =>
  canvas()
    .locator("[data-puck-overlay]")
    .filter({ has: canvas().locator('.wf-outline[data-state="selected"]') })
    .locator(`[title="${title}"]`);

test("deleting a page says how many pages change, and undo brings it back", async () => {
  await right().getByRole("tab", { name: "Site" }).click();
  await page
    .getByRole("list", { name: "Pages" })
    .getByRole("button", { name: "Actions for About" })
    .click();
  await page.getByRole("menuitem", { name: "Delete…" }).click();

  // About is in the menu every page shows: Home, About and "Not found".
  await expect(confirmation()).toHaveAccessibleName("Delete page 'About'?");
  await expect(confirmation()).toContainText("This changes 3 pages. You can undo it afterwards.");
  await confirmation().getByRole("button", { name: "Delete Page" }).click();
  const about = page.getByRole("list", { name: "Pages" }).getByRole("button", { name: /^About/ });
  await expect(about).toHaveCount(0);

  await page.keyboard.press("ControlOrMeta+z");
  await expect(about).toHaveCount(1);
});

test("deleting an element of the shared Footer asks first; undo waits for the answer", async () => {
  await page
    .getByRole("region", { name: "Left panels" })
    .getByRole("tab", { name: "Undo History" })
    .click();
  const hours = canvas().getByRole("heading", { name: "Opening hours" });
  const open = canvas().getByRole("heading", { name: /^Open daily/ });

  // Typed in the Footer first.
  const field = open.locator("[contenteditable]");
  await field.hover();
  await field.click();
  await placeCaret(field, "end");
  await page.keyboard.type(" 8-6", { delay: 20 });
  await expect(open).toHaveText("Open daily 8-6");

  // Selected by clicking past the end of its text (clicking the text edits it), then deleted.
  const box = await hours.boundingBox();
  if (box === null) throw new Error("Heading not visible");
  await hours.click({ position: { x: box.width * 0.97, y: box.height - 2 } });
  await quickAction("Delete").click();
  await expect(confirmation()).toHaveAccessibleName("Delete Heading from the shared Footer?");
  await expect(confirmation()).toContainText("This changes 3 pages.");

  // Undo, Delete and Duplicate do nothing while it asks: the typing stays, as the step it is.
  await page.keyboard.press("ControlOrMeta+z");
  await page.keyboard.press("ControlOrMeta+d");
  await expect(confirmation()).toBeVisible();
  await expect(open).toHaveText("Open daily 8-6");
  await expect(steps().first()).toHaveText("Edited shared Heading text");

  await confirmation().getByRole("button", { name: "Delete" }).click();
  await expect(hours).toHaveCount(0);
  await expect(open).toHaveText("Open daily 8-6");
  await expect(steps()).toHaveText([
    "Deleted shared Heading",
    "Edited shared Heading text",
    "Opened page",
  ]);

  // Two undo steps, and both redo.
  await page.locator(".editor__canvas").focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(hours).toHaveCount(1);
  await expect(open).toHaveText("Open daily 8-6");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(open).toHaveText("Open daily");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(hours).toHaveCount(0);
  await expect(open).toHaveText("Open daily 8-6");

  // Esc cancels the question, and the element stays.
  const openBox = await open.boundingBox();
  if (openBox === null) throw new Error("Heading not visible");
  await open.click({ position: { x: openBox.width * 0.97, y: openBox.height - 2 } });
  await quickAction("Delete").click();
  await expect(confirmation()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(confirmation()).toHaveCount(0);
  await expect(open).toHaveText("Open daily 8-6");
  await expect(steps().first()).toHaveText("Deleted shared Heading");
});
