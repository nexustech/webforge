import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { OPEN_WAIT } from "./budget.js";
import { clickOnCanvas } from "./canvas-click.js";
import {
  APP_START_TIMEOUT_MS,
  launchDesktopApp,
  type WebforgeApp,
  waitForCanvas,
} from "./launch.js";
import { chooseFromMenu } from "./menus.js";
import { type RendererWindow, stubFileDialogs } from "./sites.js";

// The tour (5.4a, OB-1…OB-3): offered the first time the editor opens a site the quick start made,
// three steps beside the controls they're about, then where help is; remembered in the person's
// preferences, so it isn't offered again.

let dir: string;
let app: WebforgeApp | undefined;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-onboarding-"));
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

/** The tour's card now, by its heading. */
const tourCard = (page: Page, title: string) => page.getByRole("region", { name: title });

/** Whether `card` sits just below `control`, within the window. */
async function below(card: Locator, control: Locator) {
  const [cardBox, controlBox] = await Promise.all([card.boundingBox(), control.boundingBox()]);
  if (cardBox === null || controlBox === null) throw new Error("not drawn");
  expect(cardBox.y).toBeGreaterThanOrEqual(controlBox.y + controlBox.height);
  expect(cardBox.y).toBeLessThan(controlBox.y + controlBox.height + 24);
}

test("offers the tour after the quick start, and shows the three steps beside their controls", async () => {
  const userData = join(dir, "user-data");
  app = await launchDesktopApp({ userDataDir: userData, site: false });
  const page = await app.firstWindow();
  await expect(page.getByRole("heading", { name: "Get started" })).toBeVisible({
    timeout: APP_START_TIMEOUT_MS,
  });
  await stubFileDialogs(app, join(dir, "Rosa's Bakery.wforge"));
  await page.getByRole("button", { name: "Start a site…", exact: true }).click();
  const quickStart = page.getByRole("dialog", { name: "Start a site" });
  await quickStart.getByRole("radio", { name: "Food and drink" }).click();
  await quickStart.getByRole("button", { name: "Create site" }).click();
  const heading = page.frameLocator(".editor__canvas iframe").locator("h1").first();
  await expect(heading).toBeVisible({ timeout: OPEN_WAIT });

  // Offered, not started (OB-1), with the focus, which isn't kept there.
  const offer = tourCard(page, "Want a quick tour?");
  await expect(offer).toBeVisible();
  await expect(offer).toBeFocused();
  await offer.getByRole("button", { name: "Show me around" }).click();

  // Change your words, beside the page's first heading.
  const words = tourCard(page, "Change your words");
  await expect(words).toContainText("Step 1 of 3");
  await expect(words).not.toHaveAttribute("data-side", "centre");
  // Not a trap: F6 goes on to the title bar, and Shift+F6 comes back to the card (5.5).
  await page.keyboard.press("F6");
  expect(
    await page.evaluate(() => document.activeElement?.closest("header[data-region]") !== null),
  ).toBe(true);
  await page.keyboard.press("Shift+F6");
  await expect(words.getByRole("button", { name: /^Learn more/ })).toBeFocused();
  await words.getByRole("button", { name: "Next" }).click();

  // See it as visitors will, below Preview; Put it online, below Publish.
  const preview = tourCard(page, "See it as visitors will");
  await expect(preview).toBeVisible();
  await expect(preview).toBeFocused();
  await below(preview, page.getByRole("button", { name: "Preview", exact: true }));
  await preview.getByRole("button", { name: "Next" }).click();
  const publish = tourCard(page, "Put it online");
  await below(publish, page.getByRole("button", { name: "Publish…", exact: true }));
  await publish.getByRole("button", { name: "Next" }).click();

  // Where help is, centred; Done closes it.
  const help = tourCard(page, "Help is always here");
  await expect(help).toHaveAttribute("data-side", "centre");
  await help.getByRole("button", { name: "Done" }).click();
  await expect(help).toHaveCount(0);

  // Remembered in the person's preferences (OB-6), never in the site.
  const onboarding = await page.evaluate(
    async () => (await (window as unknown as RendererWindow).webforge.prefs.get()).onboarding,
  );
  expect(onboarding.tour).toBe("done");

  // Help › Take the Tour, from Search Commands, at any time; Esc skips it.
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByRole("dialog", { name: "Commands" }).getByRole("combobox").fill("Take the Tour");
  await page.keyboard.press("Enter");
  await expect(tourCard(page, "Change your words")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(tourCard(page, "Change your words")).toHaveCount(0);

  // Not offered again when the site opens next.
  await app.close();
  app = await launchDesktopApp({ userDataDir: userData, site: false });
  const again = await app.firstWindow();
  await again.getByRole("button", { name: /^My site .*Rosa's Bakery\.wforge/ }).click();
  await expect(again.frameLocator(".editor__canvas iframe").locator("h1").first()).toBeVisible({
    timeout: OPEN_WAIT,
  });
  await expect(tourCard(again, "Want a quick tour?")).toHaveCount(0);
});

test("shows each first-time tip once: the first selection, Content mode, and after Theme Studio", async () => {
  app = await launchDesktopApp({ userDataDir: join(dir, "user-data"), tips: true });
  const page = await app.firstWindow();
  await waitForCanvas(page);
  // A site not made by the quick start: no tour offered.
  await expect(tourCard(page, "Want a quick tour?")).toHaveCount(0);
  const heading = page.frameLocator(".editor__canvas iframe").locator("h1").first();

  // The first selection: beside what's selected, closed with Got it.
  await clickOnCanvas(heading);
  const selection = tourCard(page, "Change what you've selected");
  await expect(selection).toContainText("Press Enter, or Edit on its bar");
  await expect(selection).not.toHaveAttribute("data-side", "centre");
  await selection.getByRole("button", { name: "Got it" }).click();
  await expect(selection).toHaveCount(0);

  // The first switch to Content mode.
  await page.getByRole("radio", { name: "Content", exact: true }).click();
  const content = tourCard(page, "Content mode");
  await expect(content).toBeVisible();
  // A tip never takes the focus from what the person is doing; it closes once they move on.
  await expect(content).not.toBeFocused();
  await page.getByRole("radio", { name: "Design", exact: true }).click();
  await expect(content).toHaveCount(0);

  // Theme Studio's, once it has closed.
  await chooseFromMenu(app, page, "View", "Theme Studio…");
  await expect(page.getByRole("dialog", { name: "Theme Studio" })).toBeVisible();
  await expect(tourCard(page, "Themes change every page")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(tourCard(page, "Themes change every page")).toBeVisible();
  await tourCard(page, "Themes change every page").getByRole("button", { name: "Got it" }).click();

  // Each once: selecting again shows nothing.
  await clickOnCanvas(heading);
  await expect(page.locator("[data-slot='tour-card']")).toHaveCount(0);
  const onboarding = await page.evaluate(
    async () => (await (window as unknown as RendererWindow).webforge.prefs.get()).onboarding,
  );
  expect(onboarding.tipsSeen).toEqual(["selection", "contentMode", "themeStudio"]);
});
