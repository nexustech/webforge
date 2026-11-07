import { existsSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, type WebforgeApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";

// Help → Open-Source Licences (5.3, C1): every package the app ships, from the notices its build
// wrote beside it, each with its licence, and Chromium's licences opened from Electron's own file.

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

test("lists every package the app ships with its licence, fonts and Electron included", async () => {
  // The files Chromium's Licences would open in the default browser, instead of opening them.
  await app.evaluate(({ shell }) => {
    const opened: string[] = [];
    Object.assign(globalThis, { opened });
    Object.assign(shell, {
      openPath: async (path: string) => {
        opened.push(path);
        return "";
      },
    });
  });

  await chooseFromMenu(app, page, "Help", "Open-Source Licences");
  const dialog = page.getByRole("dialog", { name: "Open-Source Licences" });
  const list = dialog.getByRole("list", { name: "Open-source software" });
  await expect(list.getByRole("listitem").first()).toBeVisible();

  // What the editor, the main process, the export and the installer's fonts are made with.
  const summaries = await list.locator("summary").allTextContents();
  for (const name of [
    "react ",
    "@puckeditor/core ",
    "better-sqlite3 ",
    "ssh2 ",
    "electron ",
    "zod ",
    "@jsquash/webp ",
    "@fontsource-variable/inter ",
  ]) {
    expect(
      summaries.some((summary) => summary.startsWith(name)),
      name,
    ).toBe(true);
  }
  // None of the app's own packages.
  expect(summaries.some((summary) => summary.startsWith("@webforge/"))).toBe(false);
  expect(summaries.length).toBeGreaterThan(100);

  // Found by name, and its licence's text shown once opened.
  await dialog.getByLabel("Find a package or licence").fill("better-sqlite3");
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await list.locator("summary").click();
  await expect(list.locator("pre")).toContainText(/MIT License/i);

  await dialog.getByRole("button", { name: "Chromium's Licences" }).click();
  const opened = () =>
    app.evaluate(() => (globalThis as unknown as { opened: string[] }).opened.slice());
  await expect.poll(opened).toHaveLength(1);
  const [chromium = ""] = await opened();
  expect(chromium).toMatch(/LICENSES\.chromium\.html$/);
  // Electron's own file, which is there.
  expect(existsSync(chromium)).toBe(true);
});
