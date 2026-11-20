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
 * text of the element and of its parent, all as someone sees them, or on text only where no place
 * the bar may take was clear of it (a tall section with text everywhere on a phone's short view).
 * For an element wholly out of view (scrolled away, or hidden at this width), nothing unless its
 * bar was moved: it stays with its element.
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
        const height = view.innerHeight;
        const element = (shown ?? wrapper).getBoundingClientRect();
        const barElement = shown?.querySelector<HTMLElement>(bar);
        if (element.bottom <= 0 || element.top >= height || element.width === 0) {
          const moved = barElement?.parentElement?.style.transform ?? "";
          return moved === "" ? "" : `moved (${moved}) though its element is out of view`;
        }
        const barBox = barElement?.getBoundingClientRect();
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
        type Box = { left: number; top: number; right: number; bottom: number };
        /**
         * The first text in `root` (but not in `skip`) that `box` covers by more than `slack`
         * pixels each way, line by line.
         */
        const covers = (root: Element, skip: Element | undefined, box: Box, slack: number) => {
          const clip = root.getBoundingClientRect();
          const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
            if ((node.textContent ?? "").trim() === "" || skip?.contains(node) === true) continue;
            const seen = node.parentElement?.checkVisibility({
              visibilityProperty: true,
              opacityProperty: true,
            });
            if (seen === false) continue;
            const range = doc.createRange();
            range.selectNodeContents(node);
            for (const line of range.getClientRects()) {
              const left = Math.max(line.left, clip.left, box.left);
              const right = Math.min(line.right, clip.right, box.right);
              const top = Math.max(line.top, clip.top, box.top);
              const bottom = Math.min(line.bottom, clip.bottom, box.bottom);
              if (right - left > slack && bottom - top > slack) {
                return (node.textContent ?? "").trim().slice(0, 30);
              }
            }
          }
          return undefined;
        };
        const parent = wrapper.parentElement?.closest("[data-puck-component]") ?? undefined;
        /** What `box` covers: the element's text, else its parent's, else nothing. */
        const textUnder = (box: Box, slack: number) => {
          const own = covers(wrapper, undefined, box, slack);
          if (own !== undefined) return { own };
          const theirs = parent === undefined ? undefined : covers(parent, wrapper, box, slack);
          return theirs === undefined ? {} : { theirs };
        };
        // The places the bar may take (above, below, docked at either edge, left or right), as
        // the rule tries them: the bar may cover text only where none of them is clear of it.
        const page = doc.documentElement;
        const scale = barBox.height / (barElement?.offsetHeight || barBox.height);
        const gap = 4 * scale;
        const width = barBox.width;
        const tall = barBox.height;
        const across = (x: number) => Math.max(0, Math.min(x, page.clientWidth - width));
        const tops = [
          element.top - gap - tall,
          element.bottom + gap,
          Math.min(gap, Math.max(0, page.clientHeight - tall)),
          Math.max(0, page.clientHeight - gap - tall),
        ];
        const places = tops
          .flatMap((top, index) =>
            index < 2
              ? [{ left: across(element.left), top }]
              : [
                  { left: across(element.left), top },
                  { left: across(element.right - width), top },
                ],
          )
          .filter((place) => place.top >= 0 && place.top + tall <= page.clientHeight)
          .map((place) => ({ ...place, right: place.left + width, bottom: place.top + tall }));
        // A place counts as clear only with half a pixel to spare, the bar's own as covering only
        // by more than that: rounding never makes a problem.
        const clear = places.map((place) => textUnder(place, -0.5));
        const under = textUnder(barBox, 0.5);
        if (under.own !== undefined && clear.some((text) => text.own === undefined)) {
          return `over "${under.own}", though a place was clear of it: ${where_}`;
        }
        const clearOfAll = clear.some(
          (text) => text.own === undefined && text.theirs === undefined,
        );
        if (under.own === undefined && under.theirs !== undefined && clearOfAll) {
          return `over its parent's "${under.theirs}", though a place was clear of it: ${where_}`;
        }
        return "";
      },
      { selected: SELECTED_COMPONENT, bar: ACTION_BAR, overlay: OVERLAY },
    );

/** The Layers panel's rows, every element's, opened. */
async function layers() {
  const left = page.getByRole("region", { name: "Left panels" });
  await left.getByRole("tab", { name: "Layers" }).click();
  await left.getByRole("button", { name: "Expand all" }).click();
  const rows = left.getByRole("tree", { name: "Layers" }).getByRole("treeitem");
  await expect.poll(() => rows.count()).toBeGreaterThanOrEqual(15);
  return rows;
}

test("leaves the bar of an element scrolled out of view with it", async () => {
  const rows = await layers();
  // The Header, then the page scrolled down to the Footer.
  await rows.first().click();
  await canvas()
    .locator("body")
    .evaluate((body) => body.ownerDocument.defaultView?.scrollTo(0, body.scrollHeight));
  await expect
    .poll(() =>
      canvas()
        .locator(`${SELECTED_COMPONENT} ${ACTION_BAR}`)
        .evaluate((element) => element.getBoundingClientRect().bottom),
    )
    .toBeLessThanOrEqual(0);
  await expect.poll(barProblem).toBe("");
});

test("acts on the element from its bar where it has moved", async () => {
  const rows = await layers();
  const heroes = rows.filter({ hasText: /^Hero/ });
  await expect(heroes).toHaveCount(1);
  await heroes.first().click();
  await scrollSelected("top above the view");
  // Moved from where Puck puts it, below the Hero.
  const moved = canvas().locator(SELECTED_COMPONENT).locator(ACTION_BAR).locator("xpath=..");
  await expect(moved).toHaveAttribute("style", /translate/);
  await expect.poll(barProblem).toBe("");

  await canvas().locator(SELECTED_COMPONENT).getByRole("button", { name: "Duplicate" }).click();
  await expect(heroes).toHaveCount(2);
});

for (const device of ["Desktop", "Mobile"] as const) {
  test(`keeps the selected element's bar off its text, at ${device}`, async () => {
    // Every element on the page (17), at four scrolls each.
    test.setTimeout(600_000);
    await page
      .getByRole("toolbar", { name: "Canvas" })
      .getByRole("radio", { name: device })
      .click();
    const rows = await layers();

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
