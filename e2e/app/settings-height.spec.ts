import { type ElectronApplication, expect, type Locator, type Page, test } from "@playwright/test";
import { stillBox } from "./canvas-click.js";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// Settings keeps one height whichever section is shown (#1409): it no longer jumps as a short
// section and a long one take turns. Its side nav and its buttons stay put, and only the section's
// fields scroll, in a short window too.

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

const settings = () => page.getByRole("dialog", { name: "Settings", exact: true });
const section = () => settings().locator('[data-slot="form-section"]');

/** `locator`'s box, once the dialog has finished opening. */
async function box(locator: Locator): Promise<{ top: number; bottom: number; height: number }> {
  await stillBox(locator);
  return locator.evaluate((element) => {
    const { top, bottom, height } = element.getBoundingClientRect();
    return { top, bottom, height };
  });
}

/** Shows `name`'s section, and checks the dialog is still `height` tall. */
async function expectSameHeight(name: string, height: number): Promise<void> {
  await settings().getByRole("tab", { name, exact: true }).click();
  await expect(settings().getByRole("tab", { name, exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect((await box(settings())).height, `Settings on ${name}`).toBeCloseTo(height, 0);
}

test("Settings is one height on every section, its nav and buttons fixed (#1409)", async () => {
  await page.keyboard.press("ControlOrMeta+Comma");
  const { height } = await box(settings());
  for (const name of ["Updates", "Devices", "General", "Interface"]) {
    await expectSameHeight(name, height);
  }

  // The shortest window (MIN_WINDOW_SIZE): no taller than it allows, and General's fields scroll,
  // not the dialog.
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.unmaximize());
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.setContentSize(960, 600),
  );
  await expect.poll(() => page.evaluate(() => window.innerHeight)).toBe(600);
  const short = await box(settings());
  expect(short.height).toBeLessThan(height);
  expect(short.height).toBeLessThanOrEqual(600 - 32);
  await expectSameHeight("Updates", short.height);
  await expectSameHeight("General", short.height);

  const nav = settings().getByRole("navigation");
  const cancel = settings().getByRole("button", { name: "Cancel" });
  const before = { nav: await box(nav), cancel: await box(cancel) };
  expect(before.cancel.bottom).toBeLessThanOrEqual(short.bottom);
  await expect
    .poll(() => section().evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(true);
  await section().evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect.poll(() => section().evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect((await box(nav)).top).toBeCloseTo(before.nav.top, 0);
  expect((await box(cancel)).top).toBeCloseTo(before.cancel.top, 0);
  // The dialog itself doesn't scroll.
  expect(await settings().evaluate((element) => element.scrollTop)).toBe(0);
});
