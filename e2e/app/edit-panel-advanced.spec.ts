import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// The Edit panel's Advanced tab (Advanced mode, F-ED-11): CSS classes, attributes and the anchor
// go onto the element's own HTML on the canvas, each change one labelled undo step.

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
const panel = () => page.getByRole("region", { name: "Right panels" });
const steps = () => page.locator(".undo-history__step");

/**
 * Selects the heading by clicking past the end of its text (clicking the text edits it), at its
 * bottom edge: once it is selected, its quick actions sit over its top edge, below the Header.
 */
async function selectHeading(): Promise<void> {
  const heading = canvas().locator(".site-heading");
  const box = await heading.boundingBox();
  if (box === null) throw new Error("Heading not visible");
  await heading.click({ position: { x: box.width * 0.97, y: box.height - 2 } });
}

test("sets an element's anchor and classes on the Advanced tab, in Advanced mode only", async () => {
  await selectHeading();
  await expect(panel().getByRole("tab", { name: "Advanced" })).toHaveCount(0);

  await page.getByRole("menuitem", { name: "View", exact: true }).click();
  await page.getByRole("menuitem", { name: "Use Advanced Mode" }).click();
  await selectHeading();
  await panel().getByRole("tab", { name: "Advanced" }).click();
  const anchor = panel().getByLabel("Anchor ID");
  await anchor.fill("Our welcome");
  await anchor.press("Enter");
  await expect(panel().getByText(/lowercase letters/)).toBeVisible();
  await anchor.fill("welcome");
  await anchor.press("Enter");
  const classes = panel().getByLabel("CSS classes");
  await classes.fill("italic");
  await classes.press("Enter");

  const heading = canvas().locator(".site-heading");
  await expect(heading).toHaveAttribute("id", "welcome");
  await expect(heading).toHaveClass(/(^| )italic$/);
  // The site's CSS is compiled with the new class too.
  await expect(heading).toHaveCSS("font-style", "italic");
  // In Advanced mode, Layers shares the left column with Undo History, and comes first.
  await page.getByRole("tab", { name: "Undo History" }).click();
  await expect(steps()).toHaveText([
    "Changed Heading CSS classes",
    "Changed Heading anchor ID",
    "Opened page",
  ]);
});
