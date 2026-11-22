import { expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, type WebforgeApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";

// Things You Can Ask (5.21, OL-8): example requests for the assistant, from Help and from the
// Assistant panel. Try It shows the panel with the example kept for the box: here, as the app
// starts with no AI service set up, behind the panel's own setup.

let app: WebforgeApp;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await waitForCanvas(page);
});

test.afterEach(async () => {
  await app.close();
});

test("opens from Help, finds an example, and tries it in the Assistant panel", async () => {
  await chooseFromMenu(app, page, "Help", "Things You Can Ask the Assistant…");
  const dialog = page.getByRole("dialog", { name: "Things You Can Ask" });
  await expect(dialog.getByRole("region", { name: "Search engines" })).toBeVisible();

  await dialog.getByRole("searchbox", { name: "Search the examples" }).fill("corners");
  await expect(dialog.getByRole("region")).toHaveCount(1);
  await dialog.getByRole("button", { name: "Try “Make the corners rounder.”" }).click();

  await expect(dialog).toHaveCount(0);
  const left = page.getByRole("region", { name: "Left panels" });
  await expect(left.getByRole("tab", { name: "Assistant" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  // Not set up yet: the panel asks for that first.
  await expect(left.getByRole("button", { name: "Set Up the Assistant…" })).toBeVisible();
});
