import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import {
  ACTION_BAR_LABEL,
  COMPONENT,
  HOVERED_COMPONENT,
  RICH_TEXT,
  ROOT_DROP_ZONE,
} from "@webforge/engine/puck-dom";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// The canvas's View menu (1.33, F-ED-25): outlines around every element, margins and padding on
// hover, element names and room below the page. They only change what the canvas shows: never
// the page, and never an undo step.

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  // Undo History is the left column's second tab, after Add.
  await page
    .getByRole("region", { name: "Left panels" })
    .getByRole("tab", { name: "Undo History" })
    .click();
  await expect(canvas().locator("h1")).toHaveText("Welcome to our business");
  // The site's CSS changes the layout when it arrives: a hover before then can find its element
  // moved out from under the pointer, and the hover ends (macOS and Windows CI, #412).
  await waitForCanvas(page);
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const steps = () => page.locator(".undo-history__step");

/** Turns a View menu option on or off; the menu stays open, so Escape closes it. */
async function toggle(name: string): Promise<void> {
  await page.getByRole("toolbar", { name: "Canvas" }).getByRole("button", { name: "View" }).click();
  await page.getByRole("menuitemcheckbox", { name }).click();
  await page.keyboard.press("Escape");
}

test("shows outlines, element names, spacing on hover and extra space, none an undo step", async () => {
  const before = await steps().count();
  const root = canvas().locator("html");
  const wrapper = canvas()
    .locator(COMPONENT)
    .filter({ has: canvas().locator("h1") });

  // Outlines are on by default: a dashed line around every element.
  await expect(root).toHaveAttribute("data-wf-view-outlines", "");
  await expect(wrapper.first()).toHaveCSS("outline-style", "dashed");
  await toggle("Show outlines");
  await expect(wrapper.first()).not.toHaveCSS("outline-style", "dashed");

  // Element names: one for each element, the Heading's among them.
  await toggle("Show element names");
  await expect(canvas().locator(".wf-view-name", { hasText: "Heading" }).first()).toBeVisible();

  // Spacing on hover: the hovered element's margin and padding.
  await toggle("Show spacing on hover");
  await canvas().locator("h1").hover();
  await expect(canvas().locator(".wf-view-margin")).toHaveCount(1);
  await expect(canvas().locator(".wf-view-padding")).toHaveCount(1);

  // Extra space at the bottom: room below the page's last section, however long the page is.
  const zone = canvas().locator(ROOT_DROP_ZONE);
  await expect(zone).toHaveCSS("padding-bottom", "0px");
  await toggle("Extra space at the bottom");
  await expect(zone).toHaveCSS("padding-bottom", "320px");
  const room = await zone.evaluate((element) => {
    const last = element.lastElementChild?.getBoundingClientRect().bottom ?? 0;
    return element.getBoundingClientRect().bottom - last;
  });
  expect(room).toBeGreaterThanOrEqual(320);

  // Off again: the canvas shows the page alone.
  await toggle("Show element names");
  await expect(canvas().locator(".wf-view-name")).toHaveCount(0);
  await expect(steps()).toHaveCount(before);
});

test("names a hovered element in a chip, with its size while spacing on hover is on (SP-1, SP-2)", async () => {
  const chip = canvas().locator(ACTION_BAR_LABEL, { hasText: /^Heading/ });
  // Over the Heading's own text, which Puck's inline text field used to keep from hovering it (#399).
  const text = canvas().locator("h1 [contenteditable]");

  await text.hover();
  await expect(chip).toBeVisible();
  await expect(chip).toHaveText("Heading");

  await toggle("Show spacing on hover");
  // Away and back, as the person moves on.
  await page.mouse.move(0, 0);
  await text.hover();
  await expect(chip).toHaveText(/^Heading · \d+ × \d+$/);
});

test("moves the hover straight from one element's text onto another's, one at a time (#399)", async () => {
  const chip = (name: string) =>
    canvas().locator(ACTION_BAR_LABEL, { hasText: new RegExp(`^${name}`) });
  const heading = canvas().locator("h1 [contenteditable]");
  const text = canvas().locator(`.site-text ${RICH_TEXT}`);
  const centre = async (target: typeof heading) => {
    const box = await target.boundingBox();
    if (box === null) throw new Error("Not on the canvas");
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  await heading.hover();
  await expect(chip("Heading")).toBeVisible();
  // Every change to what's hovered on the way, counted.
  await canvas()
    .locator("body")
    .evaluate((body, hovered) => {
      const counts: number[] = [];
      (window as unknown as { hoverCounts: number[] }).hoverCounts = counts;
      new MutationObserver(() => {
        counts.push(body.querySelectorAll(hovered).length);
      }).observe(body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["class"],
      });
    }, HOVERED_COMPONENT);

  const to = await centre(text);
  await page.mouse.move(to.x, to.y, { steps: 12 });

  await expect(chip("Text")).toBeVisible();
  await expect(chip("Heading")).toHaveCount(0);
  const counts = await canvas()
    .locator("body")
    .evaluate(() => (window as unknown as { hoverCounts: number[] }).hoverCounts);
  // Never two hovered at once, and one at the end: no outline left behind.
  expect(Math.max(...counts, 0)).toBeLessThanOrEqual(1);
  expect(counts.at(-1)).toBe(1);
});
