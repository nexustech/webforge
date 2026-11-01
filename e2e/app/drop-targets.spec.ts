import { type ElectronApplication, expect, type Locator, type Page, test } from "@playwright/test";
import { COMPONENT, ROOT_DROP_ZONE } from "@webforge/engine/puck-dom";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// Valid drop targets only (1.13, F-ED-1): the page's top level takes sections, so an element
// dragged there is refused and goes to the nearest place that accepts it instead.

const STARTER_HEADING = "Welcome to our business";

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
  await expect(canvas().locator("h1")).toHaveText(STARTER_HEADING);
  // The site CSS changes the layout when it arrives; drags need the final positions.
  await waitForCanvas(page);
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
/** The elements at the page's top level, as the canvas shows it: the Header, sections, the Footer. */
const topLevel = () => canvas().locator(`${ROOT_DROP_ZONE} > ${COMPONENT}`);

/** Drags with real mouse events, in small steps, pressing at `grabAt` of the source's width. */
async function drag(from: Locator, to: { x: number; y: number }, grabAt: number): Promise<void> {
  const box = await from.boundingBox();
  if (box === null) throw new Error("Drag source not visible");
  const x = box.x + box.width * grabAt;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 10, y + 10, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 25 });
  // A hand settles on the target before letting go.
  // Each move needs a render to take effect, which a slow machine may not fit between instant
  // moves: wait for the next frames.
  for (const dx of [6, -6, 4, -4, 0]) {
    await page.mouse.move(to.x + dx, to.y + 1, { steps: 4 });
    await page.evaluate(
      () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
    );
  }
  await page.mouse.up();
}

test("doesn't let an element dragged between sections land at the page's top level", async () => {
  const footer = await canvas().locator(".site-footer").boundingBox();
  if (footer === null) throw new Error("Footer not visible");

  // Grabbed past the end of its text (pressing the text edits it), dropped on the Footer's upper
  // half: the top level, between the Section and the Footer.
  await drag(
    canvas().locator("h1"),
    { x: footer.x + footer.width / 2, y: footer.y + footer.height / 4 },
    0.97,
  );

  // Puck takes it to the nearest place that accepts it, its own Section, not the top level. Its
  // drop animation shows a copy for a moment.
  await expect(canvas().locator("h1")).toHaveCount(1);
  await expect(topLevel()).toHaveCount(3);
  await expect(canvas().locator(".site-section h1")).toHaveText(STARTER_HEADING);
});
