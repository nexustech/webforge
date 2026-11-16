import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { OPEN_WAIT } from "./budget.js";
import { launchDesktopApp } from "./launch.js";

// TEMPORARY (#1125): the old flow, recording why it misses. Removed before the PR is ready.

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await expect(canvas().locator("h1")).toHaveText("Welcome to our business", {
    timeout: OPEN_WAIT,
  });
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");

test("diag: the old flow", async () => {
  const section = canvas().locator(".site-section");
  const coverAtMeasure = await page.locator(".editor__canvas-cover").count();
  const box = await section.boundingBox();
  if (box === null) throw new Error("Section not visible");
  const coverAtClick = await page.locator(".editor__canvas-cover").count();
  await section.click({ force: true, position: { x: 10, y: box.height - 4 } });
  const selectedAfterClick = await expect(canvas().locator('.wf-outline[data-state="selected"]'))
    .toHaveCount(1, { timeout: 3000 })
    .then(
      () => 1,
      () => 0,
    );
  await expect(page.locator(".editor__canvas-cover")).toHaveCount(0, { timeout: 20_000 });
  const styledBox = await section.boundingBox();
  let shown = true;
  try {
    await expect(async () => {
      await section.hover({ force: true, position: { x: 10, y: box.height - 4 }, timeout: 2000 });
      await canvas().getByRole("button", { name: "Add a section here" }).hover({ timeout: 2000 });
      await expect(canvas().locator(".wf-tip")).toHaveText("Add a section here", {
        timeout: 2000,
      });
    }).toPass({ timeout: 12_000 });
  } catch {
    shown = false;
  }
  const selectedAtEnd = await canvas().locator('.wf-outline[data-state="selected"]').count();
  console.log(
    `DIAG1125 ${JSON.stringify({
      shown,
      coverAtMeasure,
      coverAtClick,
      selectedAfterClick,
      selectedAtEnd,
      measuredHeight: box.height,
      styledHeight: styledBox?.height,
    })}`,
  );
});
