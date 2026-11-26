import type { Page } from "@playwright/test";
import { NO_MOTION_ID } from "../no-motion.js";
import { exportedPageUrl } from "./exported-site.js";
import { expect, test } from "./test.js";

// The exported site's tests run with motion off (#1493): each page asks for reduced motion and has
// the no-motion sheet, unless a test turns motion on.

/** Whether the page has the sheet and asks for reduced motion, and how long a link eases for. */
function motionIn(page: Page) {
  return page.evaluate((id) => {
    const probe = document.createElement("a");
    probe.style.transition = "opacity 2s";
    document.body.append(probe);
    const duration = getComputedStyle(probe).transitionDuration;
    probe.remove();
    return {
      sheet: document.getElementById(id) !== null,
      reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
      // Seconds: browsers write 0.01 ms as 1e-05s or 0.00001s.
      seconds: Number.parseFloat(duration),
    };
  }, NO_MOTION_ID);
}

test("turns motion off on the exported site's pages, by default", async ({ page }) => {
  await page.goto(exportedPageUrl("index.html"));
  expect(await motionIn(page)).toEqual({ sheet: true, reduced: true, seconds: 0.00001 });
  // The next page too.
  await page.goto(exportedPageUrl("about.html"));
  expect((await motionIn(page)).sheet).toBe(true);
});

test.describe("for a test about motion", () => {
  test.use({ motion: true, reducedMotion: "no-preference" });

  test("leaves motion as visitors see it", async ({ page }) => {
    await page.goto(exportedPageUrl("index.html"));
    expect(await motionIn(page)).toEqual({ sheet: false, reduced: false, seconds: 2 });
  });
});
