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
  // Undo History is the left column's second tab, after Add.
  await page
    .getByRole("region", { name: "Left panels" })
    .getByRole("tab", { name: "Undo History" })
    .click();
  await expect(canvas().locator("h1")).toHaveText(STARTER_HEADING);
  // Pages is the Site tab, after Edit, in the right column (ADR 0008).
  await page
    .getByRole("region", { name: "Right panels" })
    .getByRole("tab", { name: "Site" })
    .click();
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const pages = () => page.getByRole("list", { name: "Pages" });
const pageButton = (name: string) => pages().getByRole("button", { name: new RegExp(`^${name}`) });

test.describe("Pages panel", () => {
  test("types straight into a dialog opened from a page's menu", async () => {
    // Typed, not filled: fill() focuses the field itself, which hid the menu taking the focus back
    // as it closed.
    await pages().getByRole("button", { name: "Actions for My site" }).click();
    await page.getByRole("menuitem", { name: "Rename…" }).click();
    const field = page.getByRole("dialog").getByRole("textbox", { name: "Page name" });
    await expect(field).toBeFocused();
    await page.keyboard.type("Start");
    await page.keyboard.press("Enter");
    await expect(pageButton("Start")).toBeVisible();

    await pages().getByRole("button", { name: "Actions for Start" }).click();
    await page.getByRole("menuitem", { name: "Page Settings…" }).click();
    const settings = page.getByRole("dialog", { name: "Settings for 'Start'" });
    await expect(settings.getByRole("textbox").first()).toBeFocused();
  });

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
    // A new site's "Page not found" page starts with a message (F-ED-20).
    await expect(canvas().locator("h1")).toHaveText("Sorry, this page doesn't exist");

    await pages().getByRole("button", { name: "Actions for Page not found" }).click();
    await expect(page.getByRole("menuitem", { name: "Rename…" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Delete…" })).toHaveCount(0);
  });

  test("changes a page's settings as one undo step (F-SET-2)", async () => {
    await page.getByRole("button", { name: "Add Page" }).click();
    await page.getByRole("textbox", { name: "Page name" }).fill("About us");
    await page.getByRole("dialog").getByRole("button", { name: "Add Page" }).click();

    await pages().getByRole("button", { name: "Actions for About us" }).click();
    await page.getByRole("menuitem", { name: "Page Settings…" }).click();
    const dialog = page.getByRole("dialog", { name: "Settings for 'About us'" });
    await dialog.getByRole("textbox", { name: "File name" }).fill("our story");
    await expect(dialog.getByText("File name: our-story.html")).toBeVisible();
    await dialog.getByRole("textbox", { name: "Description" }).fill("How we started");
    await dialog.getByRole("checkbox", { name: "Hide the Footer on this page" }).check();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toHaveCount(0);

    const history = page.getByRole("list", { name: "Undo History" });
    await expect(history.getByRole("button", { name: "Changed page settings" })).toHaveAttribute(
      "aria-current",
      "step",
    );

    await pages().getByRole("button", { name: "Actions for About us" }).click();
    await page.getByRole("menuitem", { name: "Page Settings…" }).click();
    await expect(dialog.getByRole("textbox", { name: "File name" })).toHaveValue("our-story");
    await expect(dialog.getByRole("textbox", { name: "Description" })).toHaveValue(
      "How we started",
    );
    await expect(
      dialog.getByRole("checkbox", { name: "Hide the Footer on this page" }),
    ).toBeChecked();
  });
});
