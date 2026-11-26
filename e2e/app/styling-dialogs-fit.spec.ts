import { type ElectronApplication, expect, type Locator, type Page, test } from "@playwright/test";
import { expectFitsWindow, expectOneScrollAreaUnder, sizeWindow } from "./fits.js";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";

// Style This… and Theme Studio at the window sizes the app supports (#1440, H3): the previews
// beside the controls, so the controls get the dialog's height; one preview with a switch in a
// short window; one scroll area under the pointer anywhere; each group's heading in view, with the
// focus never hidden under one (WCAG 2.4.11); and the dialog inside the window.

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
const right = () => page.getByRole("region", { name: "Right panels" });

/** The window sizes: 960 × 600 and 1366 × 768, and 125% text in a window that leaves 960 × 600. */
const SIZES = [
  { width: 960, height: 600, zoom: 1, short: true },
  { width: 1366, height: 768, zoom: 1, short: false },
  { width: 1200, height: 750, zoom: 1.25, short: true },
] as const;

/** How tall `element` is. */
const heightOf = (element: Locator) =>
  element.evaluate((each) => each.getBoundingClientRect().height);

/**
 * Checks `dialog`'s preview sits beside `controls`, on their right, showing one device with a
 * switch where the dialog is `short`, else Desktop and Mobile; logs their sizes for the PR.
 */
async function expectPreviewBeside(
  dialog: Locator,
  controls: Locator,
  preview: Locator,
  short: boolean,
  name: string,
): Promise<void> {
  const [controlsBox, previewBox, dialogBox] = await Promise.all([
    controls.boundingBox(),
    preview.boundingBox(),
    dialog.boundingBox(),
  ]);
  if (controlsBox === null || previewBox === null || dialogBox === null) {
    throw new Error(`${name}: not drawn`);
  }
  expect(previewBox.x, `${name}: the preview is beside the controls`).toBeGreaterThanOrEqual(
    controlsBox.x + controlsBox.width,
  );
  const frames = preview.locator("iframe");
  const devices = dialog.getByRole("radiogroup", { name: "Preview" });
  if (short) {
    await expect(devices).toBeVisible();
    await expect(frames).toHaveCount(1);
  } else {
    await expect(devices).toHaveCount(0);
    await expect(frames).toHaveCount(2);
  }
  const scale = await frames
    .first()
    .evaluate((frame) => frame.getBoundingClientRect().width / (frame as HTMLElement).offsetWidth);
  console.log(
    `[fit] ${name}: dialog ${Math.round(dialogBox.width)} × ${Math.round(dialogBox.height)}, controls ${Math.round(controlsBox.width)} × ${Math.round(controlsBox.height)}, preview ${Math.round(previewBox.width)} wide, Desktop at ${scale.toFixed(2)}`,
  );
}

/**
 * Tabs through the controls in `scroller` from its first, checking each field the focus reaches is
 * below its group's heading, which stays at the top as the fields scroll under it (WCAG 2.4.11).
 */
async function expectFocusClearOfHeadings(scroller: Locator, name: string): Promise<void> {
  await scroller.locator("button[aria-expanded]").first().focus();
  for (let step = 0; step < 40; step += 1) {
    await page.keyboard.press("Tab");
    const place = await scroller.evaluate((area) => {
      const focused = document.activeElement;
      if (focused === null || !area.contains(focused)) return "out";
      // A group's heading row: the first child of the group (its bordered box).
      const heading = focused.closest(".border-b")?.firstElementChild;
      if (heading === null || heading === undefined || heading.contains(focused)) return "heading";
      const top = focused.getBoundingClientRect().top;
      const under = heading.getBoundingClientRect().bottom;
      return top >= under - 1 ? "clear" : `under its heading by ${Math.round(under - top)} px`;
    });
    if (place === "out") break;
    expect(["clear", "heading"], `${name}, Tab ${step + 1}`).toContain(place);
  }
}

for (const size of SIZES) {
  const at = `${size.width} × ${size.height}${size.zoom === 1 ? "" : ` at ${size.zoom * 100}% text`}`;

  test(`Style This Hero gives its controls the height, its preview beside them, ${at} (H3)`, async () => {
    await sizeWindow(app, page, size);
    await left().getByRole("tab", { name: "Add" }).click();
    await left().getByRole("button", { name: "Hero", exact: true }).click();
    await expect(canvas().locator(".site-hero h1")).toBeVisible();
    await right().getByRole("tab", { name: "Style" }).click();
    await right().getByRole("button", { name: "Style This Hero…" }).click();
    const dialog = page.getByRole("dialog", { name: "Style this Hero" });
    await expectFitsWindow(dialog, `Style this Hero, ${at}`);

    // The controls at least half the dialog's height (152 px before, at 960 × 600).
    const controls = dialog.getByRole("tabpanel");
    const preview = dialog.getByRole("region", { name: "Preview", exact: true });
    expect(await heightOf(controls)).toBeGreaterThanOrEqual((await heightOf(dialog)) / 2);
    await expectPreviewBeside(dialog, controls, preview, size.short, `Style this Hero, ${at}`);

    // One scroll area under the pointer: at each group's heading, a field and the preview.
    await expectOneScrollAreaUnder(
      [
        ...(await controls.locator("button[aria-expanded]").all()),
        controls.locator("[data-field]").last(),
        preview,
      ],
      `Style this Hero, ${at}`,
    );
    await expectFocusClearOfHeadings(controls, `Style this Hero, ${at}`);

    // Where it applies, on one line until Change.
    await expect(dialog.getByText("Applies to: This Hero only")).toBeVisible();
    await dialog.getByRole("button", { name: "Change" }).click();
    await expect(dialog.getByRole("radio", { name: /^This Hero only/ })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Change" })).toBeFocused();
  });

  test(`Theme Studio's Components gives its controls the height, its preview beside them, ${at} (H3)`, async () => {
    await sizeWindow(app, page, size);
    await chooseFromMenu(app, page, "Site", "Theme Studio…");
    const dialog = page.getByRole("dialog", { name: "Theme Studio" });
    await dialog.getByRole("tab", { name: "Components" }).click();
    await expectFitsWindow(dialog, `Theme Studio's Components, ${at}`);

    const controls = dialog.getByRole("tabpanel", { name: "Components" });
    const preview = dialog.getByRole("region", { name: /as it looks in this theme$/ });
    expect(await heightOf(controls)).toBeGreaterThanOrEqual((await heightOf(dialog)) / 2);
    await expectPreviewBeside(dialog, controls, preview, size.short, `Theme Studio, ${at}`);

    await expectOneScrollAreaUnder(
      [
        ...(await controls.locator("button[aria-expanded]").all()),
        controls.locator("[data-field]").last(),
        preview,
      ],
      `Theme Studio's Components, ${at}`,
    );
    await expectFocusClearOfHeadings(controls, `Theme Studio's Components, ${at}`);
  });
}
