import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";

// Custom Code (2.11, F-ED-15): offered in Advanced mode only, its HTML shown on the canvas without
// its scripts, and still there to select in Simple mode.

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await waitForCanvas(page);
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const left = () => page.getByRole("region", { name: "Left panels" });
const panel = () => page.getByRole("region", { name: "Right panels" });
const item = (name: string) => left().getByRole("button", { name, exact: true });
const useMode = async (name: string) => {
  await chooseFromMenu(app, page, "View", name);
};

test("adds Custom Code in Advanced mode, shows its HTML without scripts, keeps it in Simple", async () => {
  await left().getByRole("tab", { name: "Elements" }).click();
  await expect(item("Heading")).toBeVisible();
  await expect(item("Custom Code")).toHaveCount(0);

  await useMode("Use Advanced Mode");
  await left().getByRole("tab", { name: "Add" }).click();
  await left().getByRole("tab", { name: "Elements" }).click();
  await item("Custom Code").click();
  const html = panel().getByLabel("HTML");
  await html.fill('<p class="promo">Sale on today</p><script>window.customRan = true</script>');
  await html.blur();

  const custom = canvas().locator(".site-custom-code");
  await expect(custom.locator("p.promo")).toHaveText("Sale on today");
  await expect(custom.locator("script")).toHaveCount(0);
  expect(await custom.evaluate(() => "customRan" in window)).toBe(false);

  // Opened in Simple mode, it stays on the page, selectable; only adding another is Advanced.
  await useMode("Use Simple Mode");
  await expect(custom).toBeVisible();
  await expect(item("Custom Code")).toHaveCount(0);
});
