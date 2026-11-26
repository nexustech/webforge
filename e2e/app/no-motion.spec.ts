import { expect, type Frame, type Page, test } from "@playwright/test";
import { NO_MOTION_ID } from "../no-motion.js";
import { launchDesktopApp, type WebforgeApp, waitForCanvas } from "./launch.js";

// The app's E2E tests run with motion off (#1493): its windows and the canvas's frame ask for
// reduced motion and have the no-motion sheet, unless a test turns motion on.

let app: WebforgeApp;

test.afterEach(async () => {
  await app.close();
});

/** The canvas's frame: the page shown. */
async function canvasFrame(page: Page): Promise<Frame> {
  const handle = await page.locator(".editor__canvas iframe").elementHandle();
  const frame = await handle?.contentFrame();
  if (frame === null || frame === undefined) throw new Error("No canvas frame");
  return frame;
}

/** Whether `frame` has the sheet and asks for reduced motion, and how many seconds a button eases for. */
function motionIn(frame: Frame) {
  return frame.evaluate((id) => {
    const probe = document.createElement("button");
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

test("turns motion off in the window and on the canvas, by default", async () => {
  app = await launchDesktopApp();
  const page = await app.firstWindow();
  await waitForCanvas(page);
  for (const frame of [page.mainFrame(), await canvasFrame(page)]) {
    await expect
      .poll(() => motionIn(frame))
      .toEqual({
        sheet: true,
        reduced: true,
        seconds: 0.00001,
      });
  }
  // A page of its own reloaded keeps it.
  await page.reload();
  await waitForCanvas(page);
  await expect.poll(async () => (await motionIn(await canvasFrame(page))).sheet).toBe(true);
  await expect.poll(async () => (await motionIn(page.mainFrame())).sheet).toBe(true);
});

test("leaves motion as people see it for a test that turns it on", async () => {
  app = await launchDesktopApp({ motion: true });
  const page = await app.firstWindow();
  await waitForCanvas(page);
  for (const frame of [page.mainFrame(), await canvasFrame(page)]) {
    expect(await motionIn(frame)).toEqual({ sheet: false, reduced: false, seconds: 2 });
  }
});
