import { rmSync } from "node:fs";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, newUserDataDir } from "./launch.js";

// Command palette and Add panel favourites (1.34, F-ED-26, UX-10, UX-11): Ctrl/Cmd+P finds
// commands, pages to go to and things to add; an Add from it is one undo step; the person's
// favourite sections lead the Add panel, after a restart too.

let app: ElectronApplication;
let page: Page;

const canvas = () => page.frameLocator(".editor__canvas iframe");
const left = () => page.getByRole("region", { name: "Left panels" });
const palette = () => page.getByRole("dialog", { name: "Commands" });
const steps = () => page.locator(".undo-history__step");
const groups = () =>
  left()
    .getByRole("list")
    .filter({ has: page.getByRole("button") });

async function launch(userDataDir?: string) {
  app = await launchDesktopApp(userDataDir === undefined ? {} : { userDataDir });
  page = await app.firstWindow();
  await expect(canvas().locator("style[data-webforge-site-css]")).toHaveCount(1);
}

test.describe("command palette", () => {
  test.beforeEach(() => launch());
  test.afterEach(() => app.close());

  test("adds a section from the keyboard, as one undo step", async () => {
    await page.keyboard.press("ControlOrMeta+p");
    await page.getByRole("combobox").pressSequentially("add hero");
    await expect(palette().getByRole("option", { name: "Add Hero" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.keyboard.press("Enter");

    await expect(palette()).toBeHidden();
    await expect(canvas().locator(".site-hero")).toHaveCount(1);
    await left().getByRole("tab", { name: "Undo History" }).click();
    await expect(steps().first()).toHaveText("Added Hero");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(canvas().locator(".site-hero")).toHaveCount(0);
  });

  test("goes to a page by its name, and still opens with Ctrl/Cmd+K", async () => {
    await page.keyboard.press("ControlOrMeta+k");
    await page.getByRole("combobox").pressSequentially("page not found");
    await palette().getByRole("option", { name: "Page not found" }).click();

    await expect(canvas().locator("h1")).toHaveText("Sorry, this page doesn't exist");
  });
});

test("keeps the person's favourite sections first, after a restart", async () => {
  const userData = newUserDataDir();
  try {
    await launch(userData);
    await left().getByRole("button", { name: "FAQ", exact: true }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Add to Favourites" }).click();
    await expect(groups().first()).toHaveAccessibleName("Favourites");
    await app.close();

    await launch(userData);
    await expect(groups().first()).toHaveAccessibleName("Favourites");
    // By name: the button also holds the canvas's drag handle, with its own label.
    await expect(groups().first().getByRole("button")).toHaveAccessibleName("FAQ");
  } finally {
    await app.close();
    rmSync(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
