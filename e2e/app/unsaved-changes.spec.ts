import { type ElectronApplication, expect, type Locator, type Page, test } from "@playwright/test";
import { launchDesktopApp } from "./launch.js";
import { chooseFromMenu } from "./menus.js";

// A dialog with changes (#1439, MVP §7 item 66): a click outside leaves it open; Esc and its X
// ask "Discard your changes?", Keep Editing first; with nothing changed, all three close it at once.

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await expect(page.frameLocator(".editor__canvas iframe").locator("h1")).toBeVisible();
});

test.afterEach(async () => {
  await app.close();
});

const question = () => page.getByRole("alertdialog", { name: "Discard your changes?" });

/** A click on the dimmed area, in the window's bottom left corner, clear of every dialog. */
async function clickOutside() {
  const size = page.viewportSize() ?? { width: 1280, height: 800 };
  // Once the menu it was opened from has gone: until then a click outside is the menu's.
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.mouse.click(8, size.height - 8);
}

/** One dialog to try: how to open it, and how to change something in it. */
type Case = {
  readonly name: string;
  readonly open: () => Promise<Locator>;
  readonly change: (dialog: Locator) => Promise<void>;
};

const CASES: readonly Case[] = [
  {
    name: "Start a Site",
    open: async () => {
      await chooseFromMenu(app, page, "File", "Start a Site…");
      return page.getByRole("dialog", { name: "Start a site" });
    },
    change: (dialog) =>
      dialog.getByRole("textbox", { name: "Business or site name" }).fill("Rosa's Bakery"),
  },
  {
    name: "Settings",
    // On the site's own section, where its name is.
    open: async () => {
      await chooseFromMenu(app, page, "Site", "Site Settings…");
      return page.getByRole("dialog", { name: "Settings", exact: true });
    },
    change: (dialog) => dialog.getByRole("textbox", { name: "Site name" }).fill("Rosa's Bakery"),
  },
  {
    name: "Page Settings",
    open: async () => {
      const panel = page.getByRole("region", { name: "Right panels" });
      await panel.getByRole("tab", { name: "Site", exact: true }).click();
      await panel
        .getByRole("list", { name: "Pages" })
        .getByRole("button", { name: /^Actions for / })
        .first()
        .click();
      await page.getByRole("menuitem", { name: "Page Settings…" }).click();
      return page.getByRole("dialog", { name: /^Settings for / });
    },
    // The Home page's: its file name is fixed, its title isn't.
    change: (dialog) => dialog.getByRole("textbox", { name: "Title" }).fill("Welcome"),
  },
];

for (const each of CASES) {
  test.describe(each.name, () => {
    test("closes at once with nothing changed: from a click outside, Esc and its X", async () => {
      let dialog = await each.open();
      await expect(dialog).toBeVisible();
      await clickOutside();
      await expect(dialog).toHaveCount(0);

      dialog = await each.open();
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);

      dialog = await each.open();
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(question()).toHaveCount(0);
    });

    test("with a change, stays open on a click outside, and asks on Esc and its X", async () => {
      const dialog = await each.open();
      await expect(dialog).toBeVisible();
      await each.change(dialog);

      await clickOutside();
      await expect(dialog).toBeVisible();
      await expect(question()).toHaveCount(0);

      await page.keyboard.press("Escape");
      await expect(question()).toBeVisible();
      await expect(question().getByRole("button", { name: "Keep Editing" })).toBeFocused();
      await question().getByRole("button", { name: "Keep Editing" }).click();
      await expect(question()).toHaveCount(0);
      await expect(dialog).toBeVisible();

      await dialog.getByRole("button", { name: "Close", exact: true }).click();
      await expect(question()).toBeVisible();
      await question().getByRole("button", { name: "Discard" }).click();
      await expect(question()).toHaveCount(0);
      await expect(dialog).toHaveCount(0);
    });
  });
}
