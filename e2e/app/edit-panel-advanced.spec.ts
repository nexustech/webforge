import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { clickOnCanvas } from "./canvas-click.js";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";

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
  await clickOnCanvas(heading, { position: { x: box.width * 0.97, y: box.height - 2 } });
}

test("sets an element's anchor and classes on the Advanced tab, in Advanced mode only", async () => {
  await selectHeading();
  await expect(panel().getByRole("tab", { name: "Advanced" })).toHaveCount(0);

  await chooseFromMenu(app, page, "View", "Use Advanced Mode");
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

test("suggests the site's classes as one is typed, and warns about one that makes no style (#276)", async () => {
  await chooseFromMenu(app, page, "View", "Use Advanced Mode");
  await selectHeading();
  await panel().getByRole("tab", { name: "Advanced" }).click();
  const classes = panel().getByRole("combobox", { name: "CSS classes" });
  const heading = canvas().locator(".site-heading");
  const before = await heading.evaluate((element) => getComputedStyle(element).backgroundColor);

  // Suggested from every class the site's styles support, the theme's colours included, once the
  // canvas styles worker has listed them.
  await expect(panel().getByRole("button", { name: "Browse classes…" })).toBeEnabled();
  await classes.click();
  await page.keyboard.type("bg-pri");
  await expect(panel().getByRole("option", { name: "bg-primary", exact: true })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(classes).toHaveValue("bg-primary ");
  await page.keyboard.press("Enter");

  await expect(heading).toHaveClass(/(^| )bg-primary$/);
  await expect
    .poll(() => heading.evaluate((element) => getComputedStyle(element).backgroundColor))
    .not.toBe(before);
  await page.getByRole("tab", { name: "Undo History" }).click();
  await expect(steps()).toHaveText(["Changed Heading CSS classes", "Opened page"]);

  // A typo still saves, with a warning that says what was meant.
  await classes.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" pading-4");
  if (await panel().getByRole("listbox").isVisible()) await page.keyboard.press("Escape");
  await page.keyboard.press("Enter");
  await expect(panel().getByText("No style called pading-4. Did you mean p-4?")).toBeVisible();
  await expect(heading).toHaveClass(/(^| )pading-4$/);
});
