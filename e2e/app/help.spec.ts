import { expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, type WebforgeApp, waitForCanvas } from "./launch.js";

// Help in the app (5.4b, HP-6, HP-10): F1 opens the Help window beside the editor, with the pages
// that come with the app; it's one window, opened again where it's asked for.

let app: WebforgeApp;
let editor: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  editor = await app.firstWindow();
  await waitForCanvas(editor);
});

test.afterEach(async () => {
  await app.close();
});

/** Opens Help from the editor with F1, and gives its window. */
async function openHelp(): Promise<Page> {
  const opened = app.waitForEvent("window");
  await editor.keyboard.press("F1");
  const help = await opened;
  await help.waitForLoadState("domcontentloaded");
  return help;
}

test("opens Help with F1, with its contents, pages, links between them, Back and search", async () => {
  const help = await openHelp();
  await expect(help).toHaveTitle(/Help$/);
  const main = help.getByRole("main");
  await expect(main.getByRole("heading", { level: 1, name: "All help pages" })).toBeVisible();

  // A page from the contents, and a link on it to another page, then Back.
  const contents = help.getByRole("navigation", { name: "Contents" });
  await contents.getByRole("button", { name: "Site Check", exact: true }).click();
  await expect(main.getByRole("heading", { level: 1, name: "Site Check" })).toBeVisible();
  await main.getByRole("link", { name: "Forms", exact: true }).first().click();
  await expect(main.getByRole("heading", { level: 1, name: "Forms" })).toBeVisible();
  await main.getByRole("button", { name: "Back to the page before" }).click();
  await expect(main.getByRole("heading", { level: 1, name: "Site Check" })).toBeVisible();

  // Search finds a page by a word in its text.
  await help.getByRole("searchbox", { name: "Search help" }).fill("password store");
  const results = help.getByRole("region", { name: "Pages with those words" });
  await results.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(main.getByRole("heading", { level: 1, name: "Publish" })).toBeVisible();

  // The app's name is filled in, and the page has none of the editor's API.
  await expect(main.getByText("{appName}")).toHaveCount(0);
  expect(
    await help.evaluate(() => ({
      require: typeof (globalThis as { require?: unknown }).require,
      process: typeof (globalThis as { process?: unknown }).process,
      webforge: typeof (globalThis as { webforge?: unknown }).webforge,
      webforgeHelp: Object.keys((globalThis as { webforgeHelp?: object }).webforgeHelp ?? {}),
    })),
  ).toEqual({
    require: "undefined",
    process: "undefined",
    webforge: "undefined",
    webforgeHelp: ["openExternal", "onShow", "onTheme"],
  });
});

test("opens at a page and heading, and the same window again at another", async () => {
  await editor.evaluate(() =>
    (
      window as unknown as { webforge: { help: { open(target: object): Promise<boolean> } } }
    ).webforge.help.open({ page: "site-check", anchor: "tips" }),
  );
  const help = await app.waitForEvent("window");
  const main = help.getByRole("main");
  await expect(main.getByRole("heading", { level: 2, name: "Tips" })).toBeInViewport();

  // Again, from Search Commands' Help group: the same window, at that page.
  await editor.bringToFront();
  await editor.keyboard.press("Control+P");
  await editor.getByRole("combobox").fill("Help: Keyboard shortcuts");
  await editor.keyboard.press("Enter");
  await expect(main.getByRole("heading", { level: 1, name: "Keyboard shortcuts" })).toBeVisible();
  expect(app.windows()).toHaveLength(2);
});

test("opens Help from a ? at its section, and for the selected element at its heading", async () => {
  // Site Check's rules each have a ?, which opens the section that explains them.
  await editor.getByRole("button", { name: "Show or Hide Bottom Panel" }).click();
  const placeholders = editor
    .getByRole("region", { name: "Bottom panel" })
    .locator('[data-rule="placeholders"]');
  const opened = app.waitForEvent("window");
  await placeholders.getByRole("button", { name: "Help: Placeholder text" }).click();
  const help = await opened;
  const main = help.getByRole("main");
  await expect(main.getByRole("heading", { level: 2, name: "Should fix" })).toBeInViewport();

  // Selected from Site Check, the starter page's Text: Help for This Element opens its heading.
  await editor.bringToFront();
  await placeholders
    .getByRole("button", { name: /^Show Text on / })
    .first()
    .click();
  await editor.keyboard.press("Control+P");
  await editor.getByRole("combobox").fill("Help for This Element");
  await editor.keyboard.press("Enter");
  await expect(main.getByRole("heading", { level: 1, name: "Elements" })).toBeVisible();
  await expect(main.getByRole("heading", { level: 3, name: "Text" })).toBeInViewport();
  expect(app.windows()).toHaveLength(2);
});
