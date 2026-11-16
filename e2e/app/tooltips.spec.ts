import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { ACTION_BAR_ACTION } from "@webforge/engine/puck-dom";
import { OPEN_WAIT } from "./budget.js";
import { launchDesktopApp } from "./launch.js";

// The editor's tooltips (#1011): on pointing at a control and on the keyboard's focus, with its
// shortcut, and why it's off when it is; the canvas's own controls and Puck's too, in the frame.

const STARTER_HEADING = "Welcome to our business";

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  // A launch's first page, which a busy runner can take longer to draw (ADR 0014).
  await expect(canvas().locator("h1")).toHaveText(STARTER_HEADING, { timeout: OPEN_WAIT });
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const toolbar = () => page.getByRole("toolbar", { name: "Canvas" });
const layersTools = () =>
  page.getByRole("region", { name: "Left panels" }).getByRole("toolbar", { name: "Layer actions" });
const tooltip = () => page.getByRole("tooltip");
/** The canvas chrome's tooltip, in the frame. */
const frameTip = () => canvas().locator(".wf-tip");

test("shows a toolbar's tooltips with their shortcuts, on hover and on the keyboard's focus", async () => {
  await toolbar().getByRole("radio", { name: "Tablet" }).hover();
  // Ctrl+2, or ⌘2 on a Mac.
  await expect(tooltip()).toHaveText(/^Tablet \(.+2\)$/);
  // Off it, onto the left panels: not the title bar's empty part, the window's drag area, which
  // passes the page no pointer events, nor the canvas, whose frame takes them from the editor's.
  // Twice, as a hand moves: the tooltip closes on a move after the pointer has left it.
  const left = page.getByRole("region", { name: "Left panels" });
  await left.hover({ position: { x: 20, y: 40 } });
  await left.hover({ position: { x: 30, y: 50 } });
  await expect(tooltip()).toHaveCount(0);

  // A key first, so the focus counts as the keyboard's.
  await page.keyboard.press("Shift");
  await toolbar().getByRole("radio", { name: "Mobile" }).focus();
  await expect(tooltip()).toHaveText(/^Mobile \(.+3\)$/);
});

test("says why a greyed-out Layers button is off", async () => {
  const moveUp = layersTools().getByRole("button", { name: "Move up" });
  await expect(moveUp).toBeDisabled();
  // A disabled button takes no pointer: its wrapper shows the tooltip.
  await moveUp.locator("..").hover();
  await expect(tooltip()).toContainText("Move up");
  await expect(tooltip()).toContainText("Select an element first.");
});

test("shows the canvas's own controls' tooltips, and Puck's, in place of the browser's", async () => {
  const section = canvas().locator(".site-section");
  const box = await section.boundingBox();
  if (box === null) throw new Error("Section not visible");
  // The Section's bottom padding selects the Section itself.
  await section.click({ force: true, position: { x: 10, y: box.height - 4 } });

  // Pointed at again until it shows: on a cold start the + can still move as the selection
  // settles, out from under the pointer before the tooltip's delay is up.
  await expect(async () => {
    await page.mouse.move(0, 0);
    await canvas().getByRole("button", { name: "Add a section here" }).hover();
    await expect(frameTip()).toHaveText("Add a section here", { timeout: 2000 });
  }).toPass();
  // A site whose own rules would reach the tooltip, which sits in the site's body: added, read
  // and removed at once, so the canvas's layout never moves under the pointer.
  expect(
    await frameTip().evaluate((tip) => {
      const site = tip.ownerDocument.createElement("style");
      site.textContent =
        "body { letter-spacing: 3px; text-transform: uppercase; } div { margin: 20px; }";
      tip.ownerDocument.head.append(site);
      const style = getComputedStyle(tip);
      const read = [style.letterSpacing, style.textTransform, style.marginTop];
      site.remove();
      return read;
    }),
  ).toEqual(["normal", "none", "0px"]);

  const remove = canvas()
    .locator(ACTION_BAR_ACTION)
    .and(canvas().getByRole("button", { name: "Delete", exact: true }));
  await remove.hover();
  await expect(frameTip()).toHaveText("Delete");
  // The browser's own tooltip is gone; the button keeps its name.
  await expect(remove).not.toHaveAttribute("title");
  await expect(remove).toHaveAttribute("aria-label", "Delete");
});
