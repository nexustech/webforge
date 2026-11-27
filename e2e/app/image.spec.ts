import { type ElectronApplication, expect, type Locator, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// The Image element on the canvas (2.9), and its width handles (2.17): a grip on each edge of the
// selected Image, which snaps its width to a step as one undo step; the Edit panel's slider does
// the same from the keyboard.

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

const canvas = () => page.frameLocator(".editor__canvas iframe");
const left = () => page.getByRole("region", { name: "Left panels" });

/**
 * Waits until `grip` stays put across two animation frames and is what a press at its centre hits
 * (#616): as the Image's frame and the selection's overlay settle it moves, or is covered, and a
 * press then lands on the Image and drags it instead (macOS CI).
 */
async function settled(grip: Locator) {
  let last = "";
  await expect
    .poll(async () => {
      const now = await grip.evaluate(
        (element) =>
          new Promise<string>((resolve) => {
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                const { x, y, width, height } = element.getBoundingClientRect();
                const hit = element.ownerDocument.elementFromPoint(x + width / 2, y + height / 2);
                resolve(
                  hit !== null && element.contains(hit)
                    ? `${x},${y},${width},${height}`
                    : "covered",
                );
              }),
            );
          }),
      );
      const steady = now !== "covered" && now === last;
      last = now;
      return steady;
    })
    .toBe(true);
}

test("shows an Image without its image as a hint to choose one, as the editor opens (#367)", async () => {
  await left().getByRole("tab", { name: "Elements" }).click();
  await left().getByRole("button", { name: "Image", exact: true }).click();

  await expect(canvas().locator(".site-image")).toHaveText(
    "No image yet: choose one in the Edit panel",
  );
});

test("narrows an Image by dragging a grip on its edge, snapping to a width, as one step", async () => {
  await left().getByRole("tab", { name: "Elements" }).click();
  await left().getByRole("button", { name: "Image", exact: true }).click();
  const image = canvas().locator(".site-image");
  await expect(image).toHaveCount(1);
  // A new element's classes reach the canvas's CSS a moment after it is placed: until then the
  // Image is one line high, then its 16:9 frame. Its grips sit halfway down its edges, so they
  // move: grabbed too early, the press lands on the Image and drags it instead (macOS CI).
  await expect
    .poll(() => image.evaluate((element) => element.getBoundingClientRect().height))
    .toBeGreaterThan(100);
  const width = () =>
    image.evaluate((element) => Math.round(element.getBoundingClientRect().width));
  // Placed, it is selected, as wide as its column, with a grip on each edge.
  const grip = canvas().locator('.wf-width-grip[data-side="right"]');
  await expect(grip).toBeVisible();
  await expect(canvas().locator('.wf-width-grip[data-side="left"]')).toBeVisible();
  const full = await width();
  expect(full).toBeGreaterThan(672);

  // Dragged in close to its middle: as narrow as it goes, Small (320 px).
  await settled(grip);
  const from = await grip.boundingBox();
  const box = await image.boundingBox();
  if (from === null || box === null) throw new Error("not shown");
  const y = from.y + from.height / 2;
  await page.mouse.move(from.x + from.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 10, y, { steps: 8 });
  await page.mouse.up();

  await expect.poll(width).toBe(320);

  // The grip follows its edge in: dragged 64 px out, centred, it is 448 px wide, Medium.
  const centreOf = async () => {
    const at = await grip.boundingBox();
    if (at === null) throw new Error("not shown");
    return { x: at.x + at.width / 2, y: at.y + at.height / 2 };
  };
  const edge = async () => {
    const shown = await image.boundingBox();
    return shown === null ? 0 : Math.round(shown.x + shown.width);
  };
  await expect.poll(async () => Math.abs((await centreOf()).x - (await edge()))).toBeLessThan(6);
  await settled(grip);
  const start = await centreOf();
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 64, start.y, { steps: 8 });
  await page.mouse.up();
  await expect.poll(width).toBe(448);

  await left().getByRole("tab", { name: "Undo History" }).click();
  await expect(page.locator(".undo-history__step")).toHaveText([
    "Changed Image width",
    "Changed Image width",
    "Added Image",
    "Opened page",
  ]);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(width).toBe(320);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(width).toBe(full);
});
