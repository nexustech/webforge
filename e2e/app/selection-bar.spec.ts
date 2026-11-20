import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { ACTION_BAR, OVERLAY, SELECTED_COMPONENT } from "@webforge/engine/puck-dom";
import {
  APP_START_TIMEOUT_MS,
  launchDesktopApp,
  removeWhenFree,
  type WebforgeApp,
  waitForCanvas,
} from "./launch.js";
import { stubFileDialogs } from "./sites.js";
import { createFromTemplate, TEMPLATES } from "./templates.js";

// The selected element's bar (#1177, the UX/UI review's F5): wherever an element on the Café's
// home page is, at Desktop and Mobile widths and at any scroll, its bar stays inside the canvas and
// off the element's own text.

let dir: string;
let app: WebforgeApp | undefined;
let page: Page;

test.beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "webforge-selection-bar-"));
  app = await launchDesktopApp({ userDataDir: join(dir, "user-data"), site: false });
  page = await app.firstWindow();
  await expect(page.getByRole("heading", { name: "Get started" })).toBeVisible({
    timeout: APP_START_TIMEOUT_MS,
  });
  await stubFileDialogs(app, join(dir, "Café.wforge"));
  await createFromTemplate(page, TEMPLATES[0]);
  await waitForCanvas(page);
  await expect(canvas().locator("h1")).toHaveText(TEMPLATES[0].heading);
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  void removeWhenFree(dir);
});

const canvas = () => page.frameLocator(".editor__canvas iframe");

/** Where the selected element is scrolled to: as shown, or its top or bottom at the view's edge. */
type Scroll = "as shown" | "top at the top" | "top above the view" | "bottom at the bottom";
const SCROLLS: readonly Scroll[] = [
  "as shown",
  "top at the top",
  "top above the view",
  "bottom at the bottom",
];

/**
 * Scrolls the canvas to put the selected element `where`, then waits 200 ms: the bar follows the
 * scroll, and Puck measures its element again every 100 ms.
 */
const scrollSelected = (where: Scroll) =>
  canvas()
    .locator("body")
    .evaluate(
      async (body, { where, selected }) => {
        const view = body.ownerDocument.defaultView;
        const box = body.ownerDocument.querySelector(selected)?.getBoundingClientRect();
        if (view === null || box === undefined) return;
        const height = view.innerHeight;
        view.scrollBy(
          0,
          {
            "as shown": 0,
            "top at the top": box.top - 2,
            "top above the view": box.top + Math.min(box.height / 2, height / 3),
            "bottom at the bottom": box.bottom - height + 2,
          }[where],
        );
        await new Promise((resolve) => setTimeout(resolve, 200));
      },
      { where, selected: SELECTED_COMPONENT },
    );

/**
 * What's wrong with the selected element's bar: nothing when it's inside the view and off the
 * element's text, or the element's whole box is out of view (an element hidden at this width, say).
 */
const barProblem = () =>
  canvas()
    .locator("body")
    .evaluate(
      (body, { selected, bar, overlay }) => {
        const doc = body.ownerDocument;
        const view = doc.defaultView;
        const shown = doc.querySelector(selected);
        const id = shown
          ?.closest(overlay)
          ?.querySelector(".wf-outline")
          ?.getAttribute("data-wf-id");
        const wrapper =
          id === null || id === undefined
            ? null
            : doc.querySelector(`[data-puck-component="${CSS.escape(id)}"]`);
        if (view === null || wrapper === null) return "nothing selected";
        const box = () => (shown ?? wrapper).getBoundingClientRect();
        const height = view.innerHeight;
        const element = box();
        if (element.bottom <= 0 || element.top >= height || element.width === 0) return "";
        const barBox = shown?.querySelector(bar)?.getBoundingClientRect();
        if (barBox === undefined) return "no bar";
        const where_ = `bar at ${Math.round(barBox.left)},${Math.round(barBox.top)}–${Math.round(barBox.bottom)}, element ${Math.round(element.top)}–${Math.round(element.bottom)} of ${height}`;
        if (
          barBox.top < -0.5 ||
          barBox.bottom > height + 0.5 ||
          barBox.left < -0.5 ||
          barBox.right > view.innerWidth + 0.5
        ) {
          return `outside the canvas: ${where_}`;
        }
        // The element's own text, line by line.
        const walker = doc.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
          if ((node.textContent ?? "").trim() === "") continue;
          const range = doc.createRange();
          range.selectNodeContents(node);
          for (const line of range.getClientRects()) {
            const overlaps =
              line.width > 0 &&
              line.left < barBox.right - 0.5 &&
              line.right > barBox.left + 0.5 &&
              line.top < barBox.bottom - 0.5 &&
              line.bottom > barBox.top + 0.5;
            if (overlaps) {
              return `over "${(node.textContent ?? "").trim().slice(0, 30)}": ${where_}`;
            }
          }
        }
        return "";
      },
      { selected: SELECTED_COMPONENT, bar: ACTION_BAR, overlay: OVERLAY },
    );

for (const device of ["Desktop", "Mobile"] as const) {
  test(`keeps the selected element's bar off its text, at ${device}`, async () => {
    // Every element on the page (17), at four scrolls each.
    test.setTimeout(600_000);
    await page
      .getByRole("toolbar", { name: "Canvas" })
      .getByRole("radio", { name: device })
      .click();
    const left = page.getByRole("region", { name: "Left panels" });
    await left.getByRole("tab", { name: "Layers" }).click();
    await left.getByRole("button", { name: "Expand all" }).click();
    const rows = left.getByRole("tree", { name: "Layers" }).getByRole("treeitem");
    await expect.poll(() => rows.count()).toBeGreaterThanOrEqual(15);

    const problems: string[] = [];
    for (let row = 0; row < (await rows.count()); row += 1) {
      const item = rows.nth(row);
      const name = `${row}: ${(await item.textContent())?.trim()}`;
      // Selected from Layers, which shows it (#1176), then scrolled each way in turn.
      await item.click();
      await expect(item).toHaveAttribute("aria-selected", "true");
      for (const where of SCROLLS) {
        await scrollSelected(where);
        // Checked again for a moment: in a window behind others, the scroll's event and Puck's
        // measuring come late.
        let problem = "";
        await expect
          .poll(async () => {
            problem = await barProblem();
            return problem;
          })
          .toBe("")
          .catch(() => problems.push(`${name}, ${where}: ${problem}`));
      }
    }
    expect(problems).toEqual([]);
  });
}
