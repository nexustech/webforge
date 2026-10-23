import { rmSync } from "node:fs";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, newUserDataDir } from "./launch.js";

// The canvas toolbar (1.15, F-ED-8): device views, a custom width and the page shown, none of
// them an undo step (U6).

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
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const toolbar = () => page.getByRole("toolbar", { name: "Canvas" });
/** The page's width inside the canvas, in CSS pixels, whatever the zoom. */
const pageWidth = () =>
  canvas()
    .locator("body")
    .evaluate((body) => body.ownerDocument.documentElement.clientWidth);
const steps = () => page.locator(".undo-history__step");

test("switches device views and widths at once, without undo steps", async () => {
  await expect.poll(pageWidth).toBe(1280);

  await toolbar().getByRole("radio", { name: "Mobile" }).click();
  await expect.poll(pageWidth).toBe(375);
  await expect(toolbar().getByRole("spinbutton", { name: "Canvas width in pixels" })).toHaveValue(
    "375",
  );

  const width = toolbar().getByRole("spinbutton", { name: "Canvas width in pixels" });
  await width.fill("900");
  await width.press("Enter");
  await expect.poll(pageWidth).toBe(900);
  await expect(toolbar().getByRole("radio", { name: "Desktop" })).toHaveAttribute(
    "aria-checked",
    "false",
  );

  await toolbar().getByRole("combobox", { name: "Page shown" }).selectOption("Page not found");
  await expect(canvas().locator("h1")).toHaveText("Sorry, this page doesn't exist");

  await expect(steps()).toHaveText(["Opened page"]);
});

test("zooms the canvas and shows the size and scale, back to Fit when the view changes", async () => {
  const zoom = toolbar().getByRole("combobox", { name: "Zoom" });
  // The readout appears once the canvas has measured the page: "1280 × 640 @ 52%".
  await expect(toolbar().getByText(/^1280 × \d+ @ \d+%$/)).toBeVisible();

  // Smaller than Fit, so the page never overflows the canvas and makes it fit again.
  await zoom.selectOption("25%");
  await expect(toolbar().getByText(/^1280 × \d+ @ 25%$/)).toBeVisible();
  await expect(zoom).toHaveValue("0.25");

  // Another view fits the page again.
  await toolbar().getByRole("radio", { name: "Tablet" }).click();
  await expect(toolbar().getByText(/^768 × \d+ @ \d+%$/)).toBeVisible();
  await expect(zoom).toHaveValue("fit");
  await expect(steps()).toHaveText(["Opened page"]);
});

test("keeps a zoom above Fit, though the page then overflows the canvas (#134)", async () => {
  // A 1280 × 800 window, so Fit is well under 150% (on a large screen it might not be).
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.unmaximize());
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.setBounds({ x: 40, y: 40, width: 1280, height: 800 }),
  );
  const zoom = toolbar().getByRole("combobox", { name: "Zoom" });
  const readout = toolbar().getByText(/^1280 × \d+ @ \d+%$/);
  // Let the window finish resizing (a resize does make the canvas fit the page again): the
  // readout shows the same small Fit four times in a row.
  const seen: string[] = [];
  await expect
    .poll(
      async () => {
        seen.push((await readout.textContent()) ?? "");
        const last = seen.slice(-4);
        return last.length === 4 && last.every((text) => text === last[0]) ? last[0] : "";
      },
      { intervals: [250], timeout: 10_000 },
    )
    .toMatch(/@ [1-9]?\d%$/);

  await zoom.selectOption("150%");

  await expect(toolbar().getByText(/^1280 × \d+ @ 150%$/)).toBeVisible();
  // The scrollbars the overflow adds don't make the canvas fit the page again: the zoom stays at
  // 150% for five samples over a second.
  const zooms: string[] = [];
  await expect
    .poll(
      async () => {
        zooms.push(await zoom.inputValue());
        return zooms.slice(-5);
      },
      { intervals: [250], timeout: 5_000 },
    )
    .toEqual(["1.5", "1.5", "1.5", "1.5", "1.5"]);
});

/** The canvas's scale, from the size readout ("1280 × 900 @ 50%"). */
async function zoom(): Promise<number> {
  const readout = await toolbar()
    .getByRole("button", { name: /^Page size/ })
    .textContent();
  return Number(/@ (\d+)%/.exec(readout ?? "")?.[1] ?? "100") / 100;
}

test("drags the canvas's edge to a width that snaps to Tablet, without an undo step (F-ED-25)", async () => {
  const before = await steps().count();
  await toolbar().getByRole("radio", { name: "Mobile" }).click();
  await expect.poll(pageWidth).toBe(375);
  const edge = page.getByRole("separator", { name: "Canvas width, right edge" });
  const box = await edge.boundingBox();
  if (box === null) throw new Error("No edge handle");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  // To 760 wide, which snaps to Tablet (768): the centred canvas's edge moves half the change.
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + ((760 - 375) / 2) * (await zoom()), y, { steps: 5 });
  await expect(page.getByText("768 px · Tablet")).toBeVisible();
  await page.mouse.up();

  await expect.poll(pageWidth).toBe(768);
  await expect(toolbar().getByRole("radio", { name: "Tablet" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(steps()).toHaveCount(before);
});

test("keeps a device the person added, after a restart (F-ED-25)", async () => {
  await app.close();
  const userData = newUserDataDir();
  try {
    app = await launchDesktopApp({ userDataDir: userData });
    page = await app.firstWindow();
    await toolbar()
      .getByRole("button", { name: /^Page size|^Devices$/ })
      .click();
    await page.getByRole("menuitem", { name: "Add device…" }).click();
    const dialog = page.getByRole("dialog", { name: "Add a device" });
    await dialog.getByRole("textbox", { name: "Name" }).fill("Kiosk");
    await dialog.getByRole("spinbutton", { name: "Width in pixels" }).fill("1080");
    await dialog.getByRole("spinbutton", { name: "Height in pixels" }).fill("1920");
    await dialog.getByRole("button", { name: "Add Device" }).click();
    await expect.poll(pageWidth).toBe(1080);
    await app.close();

    app = await launchDesktopApp({ userDataDir: userData });
    page = await app.firstWindow();
    await toolbar()
      .getByRole("button", { name: /^Page size|^Devices$/ })
      .click();
    await page.getByRole("menuitem", { name: "Kiosk (1080 × 1920)" }).click();
    await expect.poll(pageWidth).toBe(1080);
    // Rotated: its height as the width.
    await toolbar().getByRole("button", { name: "Rotate" }).click();
    await expect.poll(pageWidth).toBe(1920);
  } finally {
    await app.close();
    rmSync(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
