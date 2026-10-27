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
