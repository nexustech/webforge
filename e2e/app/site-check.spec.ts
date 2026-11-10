import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// Site Check (3.6, F-CHK-1): the bottom drawer's panel checks the open site as it changes. A
// finding jumps to where it is; some have a Fix; Should fix and Tips can be ignored for the site.

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await waitForCanvas(page);
  await page.getByRole("button", { name: "Show or Hide Bottom Panel" }).click();
});

test.afterEach(async () => {
  await app.close();
});

const drawer = () => page.getByRole("region", { name: "Bottom panel" });
const rule = (id: string) => drawer().locator(`[data-rule="${id}"]`);

test("lists the new site's placeholder text, and selects it from there", async () => {
  await expect(drawer().getByRole("tab", { name: "Site Check" })).toBeVisible();
  await expect(drawer().getByRole("heading", { name: "Must fix" })).toBeVisible();
  // The starter page's text asks the owner to write their own.
  await expect(rule("placeholders")).toHaveAttribute("data-status", "warn");
  await expect(rule("deviceNames")).toHaveAttribute("data-status", "pass");

  const panel = page.getByRole("region", { name: "Right panels" });
  await expect(panel.getByText("Select an element to edit it")).toBeVisible();
  await rule("placeholders")
    .getByRole("button", { name: /^Show Text on / })
    .click();

  // Selected: the Edit panel shows it.
  await expect(panel.getByRole("heading", { name: "Text", exact: true })).toBeVisible();
});

test("ignores a finding, and brings it back", async () => {
  const before = await rule("placeholders")
    .getByRole("button", { name: /^Show / })
    .count();
  await rule("placeholders")
    .getByRole("button", { name: /^Ignore/ })
    .first()
    .click();

  await expect(rule("placeholders").getByRole("button", { name: /^Show / })).toHaveCount(
    before - 1,
  );
  await drawer().getByRole("button", { name: "Show 1 ignored item again" }).click();
  await expect(rule("placeholders").getByRole("button", { name: /^Show / })).toHaveCount(before);
});

test("opens Site Settings at the web address from its Fix", async () => {
  await rule("webAddress").getByRole("button", { name: "Fix" }).click();

  await expect(page.getByRole("dialog", { name: "Settings", exact: true })).toBeVisible();
});

test("opens Page Settings on a page without a description, in Being found (3.17)", async () => {
  await expect(drawer().getByRole("region", { name: "Being found" })).toBeVisible();
  // The new site's home page has no description, nor has the site.
  await rule("pageDescriptions").getByRole("button", { name: "Fix" }).first().click();

  await expect(page.getByRole("dialog", { name: /^Settings for '/ })).toBeVisible();
});

test("lists a note added from the element menu as a tip, outlined on the page, until it's resolved (UX-17)", async () => {
  const tree = page
    .getByRole("region", { name: "Left panels" })
    .getByRole("tree", { name: "Layers" });
  const heading = tree.getByRole("treeitem", { name: /^Heading/ });
  const canvas = page.frameLocator(".editor__canvas iframe");
  await expect(rule("notes")).toHaveAttribute("data-status", "pass");

  await heading.click({ button: "right" });
  await page.getByRole("menu").getByRole("menuitem", { name: "Add Note…" }).click();
  const dialog = page.getByRole("dialog", { name: "Note on Heading" });
  await dialog.getByRole("textbox", { name: "Note" }).fill("Swap this photo before launch");
  await dialog.getByRole("button", { name: "Save Note" }).click();

  await expect(rule("notes")).toHaveAttribute("data-status", "warn");
  await expect(rule("notes")).toContainText("Swap this photo before launch");
  await expect(canvas.locator("h1[data-webforge-note]")).toHaveCount(1);
  await expect(heading).toContainText("has a note");
  await expect(heading).toHaveAttribute("aria-description", "Swap this photo before launch");

  await heading.click({ button: "right" });
  await page.getByRole("menu").getByRole("menuitem", { name: "Resolve Note" }).click();
  await expect(rule("notes")).toHaveAttribute("data-status", "pass");
  await expect(canvas.locator("h1[data-webforge-note]")).toHaveCount(0);
});
