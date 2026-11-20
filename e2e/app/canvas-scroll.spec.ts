import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { ACTION_BAR, SELECTED_COMPONENT } from "@webforge/engine/puck-dom";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// The canvas's scrolling (#1176, the UX/UI review's F3 and F19): an element selected from outside
// the canvas (Site Check, Layers, Find) scrolls into view, its selection bar too, and another page
// opens at its top.

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await waitForCanvas(page);
  await expect(canvas().locator("h1")).toHaveText("Welcome to our business");
  // Long enough to scroll well past a view: eight Heroes after the starter page's own sections.
  await left().getByRole("tab", { name: "Add", exact: true }).click();
  await left().getByRole("tab", { name: "Sections" }).click();
  for (let hero = 0; hero < 8; hero += 1) {
    await left()
      .getByRole("list", { name: "All sections" })
      .getByRole("button", { name: "Hero" })
      .click();
  }
  await expect.poll(scrollRoom).toBeGreaterThan(1200);
  // Settled: the page's height steady, and so the Add panel's own showing of the last Hero done,
  // before a test scrolls (a macOS run once scrolled 30 ms after the last Hero was added).
  let last = -1;
  await expect
    .poll(async () => {
      const room = await scrollRoom();
      const steady = room === last;
      last = room;
      return steady;
    })
    .toBe(true);
});

test.afterEach(async () => {
  await app?.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const left = () => page.getByRole("region", { name: "Left panels" });
const drawer = () => page.getByRole("region", { name: "Bottom panel" });
const right = () => page.getByRole("region", { name: "Right panels" });

/** How far the canvas's page scrolls beyond its view, in its own pixels. */
const scrollRoom = () =>
  canvas()
    .locator("body")
    .evaluate((body) => {
      const root = body.ownerDocument.documentElement;
      return root.scrollHeight - root.clientHeight;
    });

/** How far the canvas's page is scrolled down. */
const scrolled = () =>
  canvas()
    .locator("body")
    .evaluate((body) => body.ownerDocument.defaultView?.scrollY ?? 0);

/** Scrolls the canvas's page to its top or its bottom, as the owner might have left it. */
async function scrollTo(where: "top" | "bottom"): Promise<void> {
  await canvas()
    .locator("body")
    .evaluate((body, end) => {
      const root = body.ownerDocument.documentElement;
      root.scrollTop = end === "top" ? 0 : root.scrollHeight;
    }, where);
  if (where === "top") await expect.poll(scrolled).toBe(0);
  else await expect.poll(async () => (await scrollRoom()) - (await scrolled())).toBeLessThan(2);
}

/**
 * Whether the selected element's box, and its selection bar's above it, are inside the canvas's
 * view: "no bar" when it has none yet.
 */
const selectedInView = () =>
  canvas()
    .locator("body")
    .evaluate(
      (body, { selected, bar }) => {
        const doc = body.ownerDocument;
        const height = doc.defaultView?.innerHeight ?? 0;
        const box = doc.querySelector(selected)?.getBoundingClientRect();
        const barBox = doc.querySelector(`${selected} ${bar}`)?.getBoundingClientRect();
        if (box === undefined) return "nothing selected";
        if (barBox === undefined) return "no bar";
        const inside = (top: number, bottom: number) => top >= 0 && bottom <= height;
        return inside(box.top, box.bottom) && inside(barBox.top, barBox.bottom)
          ? "in view"
          : `${Math.round(box.top)}–${Math.round(box.bottom)}, bar from ${Math.round(barBox.top)}, of ${height}`;
      },
      { selected: SELECTED_COMPONENT, bar: ACTION_BAR },
    );

test("shows the element a Site Check finding selects, from the bottom of a long page", async () => {
  await scrollTo("bottom");
  await page.getByRole("button", { name: "Show or Hide Bottom Panel" }).click();
  await drawer()
    .locator('[data-rule="placeholders"]')
    .getByRole("button", { name: /^Show Text on / })
    .first()
    .click();

  await expect(right().getByRole("heading", { name: "Text", exact: true })).toBeVisible();
  await expect.poll(selectedInView).toBe("in view");
});

test("shows the element a Layers row selects, from the top of a long page", async () => {
  await scrollTo("top");
  await left().getByRole("tab", { name: "Layers" }).click();
  await left()
    .getByRole("tree", { name: "Layers" })
    .getByRole("treeitem", { name: /^Hero/ })
    // The last Hero added is selected already: the one before it is near the page's end too.
    .nth(-2)
    .click();

  await expect(right().getByRole("heading", { name: "Hero", exact: true })).toBeVisible();
  await expect.poll(selectedInView).toBe("in view");
});

test("shows the text Find selects, from the bottom of a long page", async () => {
  await scrollTo("bottom");
  await page.keyboard.press("ControlOrMeta+F");
  await drawer().getByRole("searchbox", { name: "Find" }).fill("visitors");
  await drawer()
    .getByRole("button", { name: /^Text · Text: Tell visitors/ })
    .click();

  await expect(right().getByRole("heading", { name: "Text", exact: true })).toBeVisible();
  await expect.poll(selectedInView).toBe("in view");
});

test("opens another page at its top, from the bottom of a long page", async () => {
  // Pages is the Site tab.
  await right().getByRole("tab", { name: "Site" }).click();
  const pages = right().getByRole("list", { name: "Pages" });

  // A copy of the long page, shown in its place: as long, so a scroll left over would stay.
  await scrollTo("bottom");
  await pages.getByRole("button", { name: /^My site/ }).hover();
  await pages.getByRole("button", { name: "Actions for My site", exact: true }).click();
  await page.getByRole("menuitem", { name: "Duplicate" }).click();
  await expect(pages.getByRole("button", { name: /^My site \(copy\)/ })).toBeVisible();
  await expect.poll(scrolled).toBe(0);

  // Back to the home page, chosen in Pages.
  await scrollTo("bottom");
  await pages.getByRole("button", { name: /^My site ?\(Home page\)/ }).click();
  await expect.poll(scrolled).toBe(0);
  await expect(canvas().locator("h1").first()).toBeInViewport();

  // A new page, added from the bottom of the long one: its Header shows.
  await scrollTo("bottom");
  await page.getByRole("button", { name: "Add Page" }).click();
  await page.getByRole("menuitem", { name: "Blank Page…" }).click();
  await page.getByRole("textbox", { name: "Page name" }).fill("Catering");
  await page.getByRole("dialog").getByRole("button", { name: "Add Page" }).click();
  await expect(canvas().getByRole("button", { name: "Add Your First Section…" })).toBeVisible();
  await expect.poll(scrolled).toBe(0);
  await expect(canvas().locator("header")).toBeInViewport();
});
