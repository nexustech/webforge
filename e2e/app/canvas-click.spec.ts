import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { clickOnCanvas } from "./canvas-click.js";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";

// The canvas click the e2e tests share (#465): it selects an element through Puck's wrapper, and
// still refuses a click something else would catch.

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

const heading = () => page.frameLocator(".editor__canvas iframe").locator("h1");

test("selects an element through its wrapper, a group, not a button", async () => {
  const wrapper = page.frameLocator(".editor__canvas iframe").locator("[data-puck-component]", {
    has: heading(),
  });
  await expect(wrapper.last()).toHaveAttribute("role", "group");

  const box = await heading().boundingBox();
  if (box === null) throw new Error("Heading not visible");
  await clickOnCanvas(heading(), { position: { x: box.width * 0.97, y: box.height - 2 } });

  await expect(
    page.getByRole("region", { name: "Right panels" }).getByRole("heading", { name: "Heading" }),
  ).toBeVisible();
});

test("refuses a click that a dialog over the canvas would catch", async () => {
  await chooseFromMenu(app, page, "File", "Site Settings…");
  await expect(page.getByRole("dialog", { name: "Settings", exact: true })).toBeVisible();

  await expect(clickOnCanvas(heading())).rejects.toThrow("the canvas is covered");
});
