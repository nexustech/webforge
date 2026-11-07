import { expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, type WebforgeApp, waitForCanvas } from "./launch.js";
import { windowAxe } from "./window-axe.js";

// The editor accessibility pass (5.5): the window's own controls pass axe (WCAG 2.1 A and AA), and
// the core flows work from the keyboard alone: moving between the window's parts (F6), selecting
// and editing on the page, the Edit panel, adding a section, Undo, and the main dialogs.

let app: WebforgeApp;

test.afterEach(async () => {
  await app.close();
});

/** Where the focus is: its role and name, enough to tell the parts apart. */
const focused = (page: Page) =>
  page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    const region = element?.closest("[data-region]");
    return {
      tag: element?.tagName.toLowerCase() ?? "",
      region: region?.getAttribute("aria-label") ?? region?.tagName.toLowerCase() ?? "",
    };
  });

const editPanelHeading = (page: Page) =>
  page.getByRole("region", { name: "Right panels" }).getByRole("heading").first();

test("the start screen, the editor and its main dialogs pass axe", async () => {
  app = await launchDesktopApp({ site: false });
  const start = await app.firstWindow();
  await start
    .getByRole("button", { name: /Start a site/ })
    .first()
    .waitFor();
  expect(await windowAxe(start)).toEqual([]);
  await app.close();

  app = await launchDesktopApp();
  const page = await app.firstWindow();
  await waitForCanvas(page);
  expect(await windowAxe(page)).toEqual([]);
  // A new site has no web address yet, so Export asks for one first.
  for (const [role, name, open] of [
    ["dialog", "Settings", () => page.keyboard.press("Control+,")],
    [
      "alertdialog",
      "Add your site's web address?",
      () => page.getByRole("button", { name: "Export Site…", exact: true }).click(),
    ],
    [
      "dialog",
      "Publish",
      () => page.getByRole("button", { name: "Publish…", exact: true }).click(),
    ],
    ["dialog", "Commands", () => page.getByRole("button", { name: /^Search commands/ }).click()],
  ] as const) {
    await open();
    const dialog = page.getByRole(role, { name });
    await expect(dialog).toBeVisible();
    expect(await windowAxe(page), name).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }
});

test("the core flows work from the keyboard alone", async () => {
  app = await launchDesktopApp();
  const page = await app.firstWindow();
  await waitForCanvas(page);
  const canvas = page.frameLocator(".editor__canvas iframe");

  // F6 goes from part to part: the title bar, the left panels, the page, the bottom panel, the right
  // panels.
  await page.keyboard.press("F6");
  expect(await focused(page)).toMatchObject({ region: "header" });
  await page.keyboard.press("F6");
  expect(await focused(page)).toMatchObject({ region: "Left panels" });
  await page.keyboard.press("F6");
  expect(await focused(page)).toMatchObject({ tag: "iframe", region: "Page" });

  // On the page, the arrows select, Enter edits the text, Esc stops; Ctrl+Z takes it back.
  await page.keyboard.press("ArrowDown");
  await expect(editPanelHeading(page)).toHaveText("Header");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(editPanelHeading(page)).toHaveText("Heading");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Typed from the keyboard ");
  await page.keyboard.press("Escape");
  await expect(canvas.getByText(/Typed from the keyboard/)).toHaveCount(1);
  await page.keyboard.press("Control+Z");
  await expect(canvas.getByText(/Typed from the keyboard/)).toHaveCount(0);

  // The bottom panel, then the Edit panel: Tab reaches its options.
  await page.keyboard.press("F6");
  expect(await focused(page)).toMatchObject({ region: "Bottom panel" });
  await page.keyboard.press("F6");
  expect(await focused(page)).toMatchObject({ region: "Right panels" });
  await page.keyboard.press("Tab");
  expect((await focused(page)).region).toBe("Right panels");

  // Back to the left panels, where the Add panel adds a section with Enter.
  for (const region of ["Bottom panel", "Page", "Left panels"]) {
    await page.keyboard.press("Shift+F6");
    expect(await focused(page)).toMatchObject({ region });
  }
  const before = await canvas.locator("section").count();
  const add = page.getByRole("region", { name: "Left panels" }).getByRole("button", {
    name: /^Hero/,
  });
  await add.focus();
  await page.keyboard.press("Enter");
  await expect(canvas.locator("section")).toHaveCount(before + 1);

  // A dialog from its shortcut, worked and closed from the keyboard, gives the focus back.
  await page.keyboard.press("Control+,");
  const settings = page.getByRole("dialog", { name: "Settings" });
  await expect(settings).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(settings).toBeHidden();
  expect((await focused(page)).region).toBe("Left panels");
});
