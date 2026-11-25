import { type ElectronApplication, expect, type Locator, type Page, test } from "@playwright/test";
import { stillBox } from "./canvas-click.js";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";

// Dialogs stay below the title bar (#1411). Windows draws its own minimise, maximise and close
// buttons over the title bar, above everything the page draws: Theme Studio, which filled the
// window but for a margin, had its X under the window's, which closed the app.

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
const studio = () => page.getByRole("dialog", { name: "Theme Studio" });
/** A dialog's own X, in its top-right corner: the last of its children. */
const cornerClose = (dialog: Locator) => dialog.locator(':scope > button[aria-label="Close"]');

/**
 * Where `dialog`'s top edge is, once it has finished opening, and where the title bar ends: the
 * bar the page draws, or the window controls' area where that's lower.
 */
async function edges(dialog: Locator): Promise<{ top: number; titleBar: number }> {
  await stillBox(dialog);
  return dialog.evaluate((element) => {
    const overlay = (
      navigator as Navigator & {
        windowControlsOverlay?: { visible: boolean; getTitlebarAreaRect(): DOMRect };
      }
    ).windowControlsOverlay;
    const controls = overlay?.visible === true ? overlay.getTitlebarAreaRect().bottom : 0;
    const bar =
      document.querySelector('[data-slot="title-bar"]')?.getBoundingClientRect().bottom ?? 0;
    return { top: element.getBoundingClientRect().top, titleBar: Math.max(bar, controls) };
  });
}

/** Checks `dialog` and its X, where it has one, are below the title bar. */
async function expectBelowTitleBar(dialog: Locator, name: string): Promise<void> {
  const { top, titleBar } = await edges(dialog);
  expect(titleBar, "the title bar is drawn").toBeGreaterThan(0);
  expect(top, `${name}'s top`).toBeGreaterThanOrEqual(titleBar);
}

/** Opens each kind of dialog in turn, checks it's below the title bar, and closes it. */
async function checkEachDialog(where: string): Promise<void> {
  await chooseFromMenu(app, page, "Site", "Theme Studio…");
  await expectBelowTitleBar(studio(), `${where}: Theme Studio`);
  await expectBelowTitleBar(cornerClose(studio()), `${where}: Theme Studio's X`);
  await cornerClose(studio()).click();
  await expect(studio()).toHaveCount(0);

  // The Edit panel's Style tab, the Hero still selected: the last round left the Theme panel open.
  await right().getByRole("tab", { name: "Edit", exact: true }).click();
  await right().getByRole("tab", { name: "Style" }).click();
  await right().getByRole("button", { name: "Style This Hero…" }).click();
  const styleThis = page.getByRole("dialog", { name: "Style this Hero" });
  await expectBelowTitleBar(styleThis, `${where}: Style this Hero`);
  await cornerClose(styleThis).click();
  await expect(styleThis).toHaveCount(0);

  await page.keyboard.press("ControlOrMeta+Comma");
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await expectBelowTitleBar(settings, `${where}: Settings`);
  await cornerClose(settings).click();
  await expect(settings).toHaveCount(0);

  // An alert dialog: switching the theme asks first.
  await right().getByRole("tab", { name: "Theme", exact: true }).click();
  const theme = right().getByRole("combobox", { name: "Theme", exact: true });
  const other = await theme.evaluate(
    (select) =>
      [...(select as HTMLSelectElement).options].find((option) => !option.selected)?.value ?? "",
  );
  await theme.selectOption(other);
  const ask = page.getByRole("alertdialog");
  await expectBelowTitleBar(ask, `${where}: an alert dialog`);
  await ask.getByRole("button", { name: "Cancel" }).click();
  await expect(ask).toHaveCount(0);
}

/** The editor window's zoom factor, as Electron has it. */
const zoomFactor = () =>
  app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.webContents.getZoomFactor(),
  );

test("every dialog starts below the title bar: full size, in a narrow window and zoomed to 150% (#1411)", async () => {
  // Three rounds of four dialogs.
  test.slow();
  // A Hero, selected, for Style this Hero….
  await left().getByRole("tab", { name: "Add" }).click();
  await left().getByRole("button", { name: "Hero", exact: true }).click();
  await expect(page.frameLocator(".editor__canvas iframe").locator(".site-hero")).toHaveCount(1);

  await checkEachDialog("full size");

  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.unmaximize());
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.setContentSize(960, 600),
  );
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(960);
  await checkEachDialog("narrow");

  // The interface zoom scales the title bar and the window controls alike.
  for (let step = 0; step < 8; step++) await page.keyboard.press("ControlOrMeta+Alt+Equal");
  await expect.poll(zoomFactor).toBeCloseTo(1.5);
  await checkEachDialog("at 150%");
});

test("Theme Studio's X closes Theme Studio, not the app, asking about a draft first (#1411, 4.10)", async () => {
  await chooseFromMenu(app, page, "Site", "Theme Studio…");
  await studio().getByRole("tab", { name: "Components" }).click();
  await studio()
    .getByRole("combobox", { name: "Sections and elements" })
    .selectOption({ value: "Features" });
  await studio()
    .locator('[data-field="lookBackground"]')
    .getByRole("radio", { name: "Accent", exact: true })
    .click();

  // A draft: the X asks whether to apply it, as Close does.
  await cornerClose(studio()).click();
  const ask = page.getByRole("alertdialog", { name: "Apply Your Changes to Every Features?" });
  await ask.getByRole("button", { name: "Keep Editing" }).click();
  await expect(studio()).toBeVisible();
  await cornerClose(studio()).click();
  await ask.getByRole("button", { name: "Discard Changes" }).click();
  await expect(studio()).toHaveCount(0);

  // No draft: it closes straight away. The window, and the site in it, stay open.
  await chooseFromMenu(app, page, "Site", "Theme Studio…");
  await cornerClose(studio()).click();
  await expect(studio()).toHaveCount(0);
  await expect(page.getByRole("banner")).toBeVisible();
  expect(page.isClosed()).toBe(false);
});
