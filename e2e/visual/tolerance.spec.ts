import { existsSync, rmSync } from "node:fs";
import { expect, test } from "@playwright/test";

// The screenshot tolerance (#281, tolerance.ts) sees a panel missing from the whole window, though
// its background nearly matches the one under it: the Window story's Layers pane, hidden, fails
// the comparison with its own screenshot. Screenshots are compared in CI's container only.

const SCREENSHOTS = process.env.VISUAL_SCREENSHOTS === "1";
const EDITOR_PORT = 6107;
/** A baseline this test writes and removes, beside the stories'. */
const BASELINE = "tolerance-window.png";

test("a whole-window screenshot fails with the Layers pane gone, its background near the panel's (#281)", async ({
  page,
}, testInfo) => {
  // As CI compares them: a missing baseline is written, a changed one fails. Updating them would
  // take the difference in instead of failing on it.
  test.skip(
    !SCREENSHOTS || testInfo.config.updateSnapshots !== "missing",
    "Screenshots are compared as CI does, in its container",
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(
    `http://127.0.0.1:${EDITOR_PORT}/iframe.html?id=shell-window--parity&viewMode=story&globals=theme:dark`,
  );
  await page.waitForFunction(
    () =>
      (window as { __STORYBOOK_PREVIEW__?: { currentRender?: { phase?: string } } })
        .__STORYBOOK_PREVIEW__?.currentRender?.phase === "finished",
  );
  await page.evaluate(() => document.fonts.ready);
  const path = testInfo.snapshotPath(BASELINE);
  try {
    // The window as it is: the baseline, written as a missing one would be.
    await expect(page).toHaveScreenshot(BASELINE);
    expect(existsSync(path)).toBe(true);

    // The Layers pane's tabs and rows hidden: the ground under them shows, a few RGB steps away.
    await page
      .getByRole("tablist")
      .filter({ has: page.getByRole("tab", { name: "Layers" }) })
      .locator("..")
      .evaluate((pane) => {
        (pane as HTMLElement).style.visibility = "hidden";
      });

    let difference = "";
    try {
      await expect(page).toHaveScreenshot(BASELINE, { timeout: 3_000 });
    } catch (error) {
      difference = String(error);
    }
    expect(difference, "the comparison sees the pane gone").toMatch(/pixels/);
  } finally {
    rmSync(path, { force: true });
  }
});
