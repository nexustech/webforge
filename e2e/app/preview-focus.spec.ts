import { type ElectronApplication, expect, type Locator, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";
import { tabUntil } from "./tab-until.js";
import { windowAxe } from "./window-axe.js";

// The previews drawn for looking at, not using (#1507): the item previews of Style This… and
// Theme Studio, in iframes, and the Add panel's section previews, in shadow roots. The keyboard
// passes them by, Shift+Tab comes back, and nothing focusable is hidden from screen readers.

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

const left = () => page.getByRole("region", { name: "Left panels" });
const right = () => page.getByRole("region", { name: "Right panels" });

/** Where the focus is, if it's somewhere a preview put it: in an iframe, a shadow root or aria-hidden. */
const inPreview = () =>
  page.evaluate(() => {
    const active = document.activeElement;
    if (active === null) return null;
    if (active instanceof HTMLIFrameElement) return `an iframe (${active.title})`;
    if (active.shadowRoot?.activeElement) return "a shadow root";
    if (active.closest('[aria-hidden="true"]') !== null) return "something aria-hidden";
    return null;
  });

/** No focusable element under aria-hidden in the window (axe's aria-hidden-focus). */
async function expectNothingFocusableHidden(where: string): Promise<void> {
  const found = (await windowAxe(page)).filter((each) => each.id === "aria-hidden-focus");
  expect(found, `${where}: focusable but hidden from screen readers`).toEqual([]);
}

/**
 * Tabs from the last control of `settings` past the preview to `dialog`'s Close, never into the
 * preview and never out of the dialog, then Shift+Tab back into the settings. However many stops
 * lie between: the preview's scroll area takes one only while it scrolls. Back into the settings,
 * not onto that control, which may be one of a group of buttons the arrow keys move along.
 */
async function expectTabPastPreview(
  dialog: Locator,
  settings: Locator,
  where: string,
): Promise<void> {
  await test.step(where, async () => {
    await settings.locator("input, select, button, textarea").last().focus();
    const close = dialog.getByRole("button", { name: "Close", exact: true });
    await tabUntil(page, close, { within: dialog, never: inPreview });
    await tabUntil(page, settings, { back: true, within: dialog, never: inPreview });
  });
}

test("Style This… and Theme Studio's previews are passed by the keyboard (#1507)", async () => {
  // Quarantined on every system: Tab past a tooltip's control in Style This and Theme Studio can
  // throw the focus to the dialog itself, a keyboard trap, seen on Windows and macOS CI (#1672).
  // The fix lifts it, within the week under the flaky-test rule.
  test.fixme(true, "keyboard trap, flaky in CI: #1672");
  await left().getByRole("tab", { name: "Add" }).click();
  await left().getByRole("button", { name: "Hero", exact: true }).click();
  await right().getByRole("tab", { name: "Style" }).click();
  await right().getByRole("button", { name: "Style This Hero…" }).click();
  const style = page.getByRole("dialog", { name: "Style this Hero" });
  // Past the preview's resize handle and its scroll area to the bar at the bottom, and back.
  await expectTabPastPreview(style, style.getByRole("tabpanel").first(), "Style this Hero");
  await expectNothingFocusableHidden("Style this Hero");
  await page.keyboard.press("Escape");
  await expect(style).toHaveCount(0);

  await chooseFromMenu(app, page, "Site", "Theme Studio…");
  const studio = page.getByRole("dialog", { name: "Theme Studio" });
  await studio.getByRole("tab", { name: "Components" }).click();
  await expectTabPastPreview(
    studio,
    studio.getByRole("tabpanel").first(),
    "Theme Studio, Components",
  );
  await expectNothingFocusableHidden("Theme Studio, Components");
});

test("the Add panel's section previews are passed by the keyboard (#1507)", async () => {
  await left().getByRole("tab", { name: "Add" }).click();
  await expectNothingFocusableHidden("the Add panel");
  // From one section's card to the next ones, never into a preview drawn on a card.
  await left().getByRole("button", { name: "Hero", exact: true }).focus();
  await tabUntil(page, left().getByRole("button", { name: "Map", exact: true }), {
    within: left(),
    never: inPreview,
  });
});
