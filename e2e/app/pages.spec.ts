import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp } from "./launch.js";

// Pages panel (1.18, F-ED-13, D5): adding a page shows it on the canvas; deleting one asks first,
// and undo brings it back.

const STARTER_HEADING = "Welcome to our business";

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await expect(canvas().locator("h1")).toHaveText(STARTER_HEADING);
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const pages = () => page.getByRole("list", { name: "Pages" });
const pageButton = (name: string) => pages().getByRole("button", { name: new RegExp(`^${name}`) });

test.describe("Pages panel", () => {
  test("adds a page, deletes it after confirming, and undo brings it back", async () => {
    await page.getByRole("button", { name: "Add Page" }).click();
    const field = page.getByRole("textbox", { name: "Page name" });
    await field.fill("About us");
    await expect(page.getByText("File name: about-us.html")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Add Page" }).click();

    // The new, empty page is shown.
    await expect(pageButton("About us")).toHaveAttribute("aria-current", "page");
    await expect(canvas().locator("h1")).toHaveCount(0);

    await pages().getByRole("button", { name: "Actions for About us" }).click();
    await page.getByRole("menuitem", { name: "Delete…" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Delete page 'About us'?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Delete Page" }).click();

    await expect(pageButton("About us")).toHaveCount(0);
    await expect(canvas().locator("h1")).toHaveText(STARTER_HEADING);

    await page.getByRole("banner").getByRole("button", { name: "Undo", exact: true }).click();
    await expect(pageButton("About us")).toHaveAttribute("aria-current", "page");
    await expect(canvas().locator("h1")).toHaveCount(0);
  });

  test("shows another page when it is clicked, and 'Page not found' can't be deleted", async () => {
    await pageButton("Page not found").click();
    await expect(pageButton("Page not found")).toHaveAttribute("aria-current", "page");

    await pages().getByRole("button", { name: "Actions for Page not found" }).click();
    await expect(page.getByRole("menuitem", { name: "Rename…" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Delete…" })).toHaveCount(0);
  });
});
