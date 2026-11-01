import { rm } from "node:fs/promises";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { CANVAS_INNER } from "@webforge/engine/puck-dom";
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

/** The size readout's text: "1600 × 640 @ 100%". */
const readout = () => toolbar().getByRole("button", { name: /^Page size/ });

/** Sets the window's content to `width` × 900 and waits until Desktop has taken the new room. */
async function windowWidth(width: number): Promise<void> {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.unmaximize());
  await app.evaluate(
    ({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0]?.setContentSize(size, 900),
    width,
  );
}

test("switches device views and widths at once, without undo steps", async () => {
  // Desktop fills the canvas (PH2-18), never under the desktop layout's 1024 px.
  await expect.poll(pageWidth).toBeGreaterThanOrEqual(1024);

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
  // The readout appears once the canvas has measured the page: "1600 × 640 @ 100%".
  await expect(toolbar().getByText(/^\d{4} × \d+ @ \d+%$/)).toBeVisible();

  // Smaller than Fit, so the page never overflows the canvas and makes it fit again.
  await zoom.selectOption("25%");
  await expect(toolbar().getByText(/^\d{4} × \d+ @ 25%$/)).toBeVisible();
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
  // Desktop is 1024 px at least, wider than this window's canvas: Fit zooms it out.
  const readout = toolbar().getByText(/^\d{4} × \d+ @ \d+%$/);
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

  await expect(toolbar().getByText(/^\d{4} × \d+ @ 150%$/)).toBeVisible();
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

test("fills the canvas in Desktop view as the window grows and shrinks, and keeps fixed widths (PH2-18)", async () => {
  const width = toolbar().getByRole("spinbutton", { name: "Canvas width in pixels" });
  /** The readout's width, once it and the page agree: the window may resize in steps. */
  const settledWidth = async () => {
    await expect
      .poll(async () => (await readout().textContent())?.startsWith(`${await pageWidth()} × `))
      .toBe(true);
    return pageWidth();
  };

  await windowWidth(1800);
  await expect.poll(pageWidth).toBeGreaterThan(1100);
  const wide = await settledWidth();
  await expect(readout()).toHaveText(/ @ 100%$/);
  await expect(width).toHaveValue(String(wide));

  await windowWidth(2200);
  await expect.poll(pageWidth).toBeGreaterThan(wide);
  await settledWidth();
  await expect(readout()).toHaveText(/ @ 100%$/);

  // A window narrower than the desktop layout: Desktop stays 1024 px, zoomed out to fit.
  await windowWidth(1100);
  await expect.poll(pageWidth).toBe(1024);
  await expect(readout()).toHaveText(/^1024 × [0-9]+ @ [1-9][0-9]%$/);

  // A fixed width from the size menu keeps its width as the window changes.
  await readout().click();
  await page.getByRole("menuitem", { name: "Desktop (1440)" }).click();
  await expect.poll(pageWidth).toBe(1440);
  await windowWidth(2200);
  await expect(readout()).toHaveText(/^1440 × [0-9]+ @ [0-9]+%$/);
  expect(await pageWidth()).toBe(1440);
  await expect(steps()).toHaveText(["Opened page"]);
});

test("lays a long page out in Desktop view without overflowing sideways, its scrollbar inside the frame (PH2-18)", async () => {
  // Long enough to scroll: four Heroes after the starter page's own section.
  const left = page.getByRole("region", { name: "Left panels" });
  await left.getByRole("tab", { name: "Add", exact: true }).click();
  await left.getByRole("tab", { name: "Sections" }).click();
  for (let hero = 0; hero < 4; hero += 1) {
    await left
      .getByRole("list", { name: "All sections" })
      .getByRole("button", { name: "Hero" })
      .click();
  }
  await windowWidth(1700);
  await expect.poll(pageWidth).toBeGreaterThan(1100);

  const frame = await canvas()
    .locator("body")
    .evaluate((body) => {
      const root = body.ownerDocument.documentElement;
      return {
        scrolls: root.scrollHeight > root.clientHeight,
        overflowsSideways: root.scrollWidth > root.clientWidth,
        width: body.ownerDocument.defaultView?.innerWidth ?? 0,
      };
    });
  // The frame scrolls itself, like a browser window; nothing spills sideways.
  expect(frame).toMatchObject({ scrolls: true, overflowsSideways: false });
  // The box Desktop measures never scrolls, so its room, and the page's width, stay put.
  const room = await page.evaluate((selector) => {
    const inner = document.querySelector(selector) as HTMLElement;
    return { scrolls: inner.scrollHeight > inner.clientHeight, width: inner.clientWidth };
  }, CANVAS_INNER);
  // Desktop takes the room's whole pixels: a fractional box can round one either way.
  expect(room.scrolls).toBe(false);
  expect(Math.abs(room.width - frame.width)).toBeLessThanOrEqual(1);
  await expect(readout()).toHaveText(new RegExp(`^${frame.width} × [0-9]+ @ 100%$`));
});

test("selects a section from a click in its padding when Desktop is zoomed out (F-ED-3, PH2-18)", async () => {
  // A window too narrow for the desktop layout: Desktop stays 1024 px and the canvas zooms out.
  await windowWidth(1100);
  await expect(readout()).toHaveText(/^1024 × [0-9]+ @ [1-9][0-9]%$/);
  const right = page.getByRole("region", { name: "Right panels" });
  await right.getByRole("tab", { name: "Edit", exact: true }).click();

  // As a person clicks: on the screen, into the section's bottom padding (8 of its own pixels in),
  // once the canvas has finished zooming (Puck animates it): where it is, not where it was.
  const section = canvas().locator(".site-section").first();
  const boxes: string[] = [];
  await expect
    .poll(
      async () => {
        boxes.push(JSON.stringify(await section.boundingBox()));
        return boxes.length >= 3 && boxes.slice(-3).every((box) => box === boxes.at(-1));
      },
      { intervals: [100] },
    )
    .toBe(true);
  const box = await section.boundingBox();
  if (box === null) throw new Error("Section not visible");
  const height = await section.evaluate((element) => element.getBoundingClientRect().height);
  const scale = box.height / height;
  expect(scale).toBeLessThan(1);
  await page.mouse.click(box.x + 10 * scale, box.y + box.height - 8 * scale);

  await expect(right.getByRole("heading", { name: "Section", exact: true })).toBeVisible();
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
  // Three launches and closes of the app: on a busy machine each takes tens of seconds (#518).
  test.slow();
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
    await rm(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("shows the Header's mobile menu open in the Mobile view, as a preview only (UX-26)", async () => {
  const menu = canvas().locator("details[data-wf-menu]");
  const selected = page.getByRole("toolbar", { name: "Selected element" });
  // The shared Header isn't in Layers: it's selected on the canvas, where Puck's overlay takes the click.
  await canvas()
    .locator(".site-header")
    .click({ force: true, position: { x: 400, y: 10 } });
  // Wide screens have no small-screen menu to preview.
  await expect(selected.getByRole("button", { name: "Show mobile menu" })).toHaveCount(0);

  await toolbar().getByRole("radio", { name: "Mobile" }).click();
  await selected.getByRole("button", { name: "Show mobile menu" }).click();
  await expect(menu).toHaveAttribute("open", "");
  await expect(menu).toHaveAttribute("data-webforge-preview", "mobile-menu");
  // Its links show, to see and select them.
  await expect(menu.getByRole("link").first()).toBeVisible();

  await selected.getByRole("button", { name: "Show mobile menu" }).click();
  await expect(menu).not.toHaveAttribute("open");
  // A view aid, never a change to the site.
  await expect(steps()).toHaveText(["Opened page"]);
});
